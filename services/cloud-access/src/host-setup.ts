import { mkdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { AccessError, type AccessSession, allBindings } from "./config";

export type LocalRuntime = { origin: string; token: string };
export function hostClient(runtime: LocalRuntime, projectId: string) {
  const url = new URL(runtime.origin);
  if (
    url.protocol !== "http:" ||
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
    url.username ||
    url.password
  )
    throw new Error("The Prompt Studio runtime must be on loopback.");
  return async (path: string, method = "GET", body?: unknown) => {
    const result = await fetch(new URL(`/v1/projects/${encodeURIComponent(projectId)}${path}`, url), {
      method,
      headers: { Authorization: `Bearer ${runtime.token}`, "Content-Type": "application/json" },
      ...(body !== undefined && { body: JSON.stringify(body) }),
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
    });
    if (!result.ok) throw new AccessError(result.status, "Prompt Studio configuration failed.");
    return result.status === 204 ? undefined : result.json();
  };
}

export async function clearConnections(runtime: LocalRuntime, projectId: string) {
  const host = hostClient(runtime, projectId);
  for (const binding of allBindings)
    await host(`/extension-connections/${binding.extensionId}/${binding.connectionId}`, "DELETE");
}

export async function applySession(input: {
  root: string;
  projectId: string;
  runtime: LocalRuntime;
  session: AccessSession;
  previewHelper: string;
  googleAuthentication?: "gcloud" | "metadata" | "broker";
}) {
  const { session } = input;
  const host = hostClient(input.runtime, input.projectId);
  const { extensions } = (await host("/extensions")) as {
    extensions: { extensionId: string; id: string; enabled: boolean }[];
  };
  const remote = extensions.find((e) => e.extensionId === "pocketcoder.remote-testing");
  const cloud = extensions.find((e) => e.extensionId === "pocketcoder.pocketcoder");
  if (!remote?.enabled || !cloud?.enabled)
    throw new Error("Install and enable Cloud Workspaces and Remote Testing first.");
  const directory = join(input.root, ".pstdio/extension-storage/pocketcoder.remote-testing/branch-templates");
  await mkdir(directory, { recursive: true });
  for (const kind of ["tests", "preview"] as const) {
    const target = join(directory, `${kind}.json`);
    const temporary = `${target}.${crypto.randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(session.manifests[kind]), { mode: 0o600 });
    await rename(temporary, target);
  }
  for (const [key, value] of Object.entries(session.settings))
    await host(`/extensions/${remote.id}/settings/${key}`, "PUT", { value });
  await host(`/extensions/${remote.id}/settings/googleAuthentication`, "PUT", {
    value: input.googleAuthentication ?? "broker",
  });
  for (const extension of [remote, cloud])
    await host(`/extensions/${extension.id}/settings/previewBridgePath`, "PUT", {
      value: session.preview ? input.previewHelper : "",
    });
  const active = new Set(session.credentials.map((c) => `${c.extensionId}/${c.connectionId}`));
  for (const binding of allBindings) {
    const path = `/extension-connections/${binding.extensionId}/${binding.connectionId}`;
    if (!active.has(`${binding.extensionId}/${binding.connectionId}`)) await host(path, "DELETE");
  }
  for (const credential of session.credentials) {
    const valid = allBindings.some(
      (b) => b.extensionId === credential.extensionId && b.connectionId === credential.connectionId,
    );
    if (!valid) throw new Error("Unexpected cloud connection.");
    await host(`/extension-connections/${credential.extensionId}/${credential.connectionId}`, "PUT", {
      baseUrl: credential.baseUrl ?? session.controllerUrl,
      secret: credential.secret,
    });
  }
}
