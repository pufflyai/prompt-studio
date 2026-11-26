import { uuid, WorkflowError } from "./routes";

export const controllerRequest = (origin: string, path: string, key: string, input?: unknown) =>
  fetch(origin + path, {
    method: input === undefined ? "GET" : "POST",
    headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
    body: input === undefined ? undefined : JSON.stringify(input),
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
  });

type Workspace = { state: string; deadline_at: string; template: { name: string }; metadata: { purpose?: string } };
type Routes = {
  origin: (id: string) => string;
  ensure: (id: string, expiresAt: number) => Promise<void>;
  healthy: (origin: string, id: string) => Promise<boolean>;
};

async function workspaceDeadline(controller: string, id: string, key: string) {
  if (!uuid.test(id)) throw new WorkflowError(400, "Choose a preview workspace.");
  const check = await controllerRequest(controller, "/v1/workspaces/" + id, key);
  if (!check.ok) throw new WorkflowError(check.status, "The preview workspace is unavailable to this key.");
  const workspace = (await check.json()) as Workspace;
  if (workspace.metadata.purpose !== "pstdio-preview" || workspace.template.name !== "prompt-studio-preview-branch")
    throw new WorkflowError(400, "Choose a Prompt Studio preview workspace.");
  if (workspace.state !== "ready") throw new WorkflowError(409, "The preview workspace is not ready.");
  const expiresAt = Math.min(Date.parse(workspace.deadline_at), Date.now() + 90 * 60_000);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now())
    throw new WorkflowError(410, "The preview workspace expired.");
  return expiresAt;
}

export function createPreviewOpener(controller: string, routes: Routes) {
  return async (id: string, key: string) => {
    const expiresAt = await workspaceDeadline(controller, id, key);
    const origin = routes.origin(id);
    const relay = "/v1/workspaces/" + id + "/services/preview-admin";
    const prepared = await controllerRequest(controller, relay + "/prepare", key, {
      workspaceId: id,
      expiresAt,
      origin,
    });
    if ([404, 425, 502, 503].includes(prepared.status))
      throw new WorkflowError(425, "Prompt Studio is still starting.");
    if (!prepared.ok) throw new WorkflowError(prepared.status, "Preview setup failed.");
    const config = (await prepared.json().catch(() => null)) as { origin?: string; expiresAt?: number } | null;
    if (config?.origin !== origin || !config.expiresAt || config.expiresAt > expiresAt)
      throw new WorkflowError(409, "Start a preview with the current isolated preview template.");
    await routes.ensure(id, config.expiresAt);
    if (!(await routes.healthy(origin, id)))
      throw new WorkflowError(425, "The preview HTTPS certificate and route are becoming ready.");
    const response = await controllerRequest(controller, relay + "/invite", key, {});
    if (!response.ok) throw new WorkflowError(response.status, "Could not create a browser invitation.");
    const invitation = (await response.json()) as { invite: string; expiresAt: string };
    if (!/^[A-Za-z0-9_-]{43}$/.test(invitation.invite) || Date.parse(invitation.expiresAt) !== config.expiresAt)
      throw new Error("Invalid preview invitation.");
    return {
      workspaceId: id,
      url: origin + "/__preview/#invite=" + invitation.invite,
      expiresAt: invitation.expiresAt,
    };
  };
}
