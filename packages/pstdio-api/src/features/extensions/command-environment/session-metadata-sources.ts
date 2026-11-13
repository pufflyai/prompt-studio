import { observeSessionAvailability } from "../../sessions/session-availability-observation";
import { observeSessionHarnessCommands } from "../../sessions/session-harness-commands";
import { observeWorkspaceDiff } from "../../workspaces/workspace-diff-observation";
import type { ExtensionsRouteDeps } from "../deps";

export const readSessionMetadataScope = async (deps: ExtensionsRouteDeps, projectId: string, id: string) => {
  const local = await deps.sessionService.get(id);
  const remote = local ? undefined : await deps.personalHistoryService.getSession(id, projectId);
  const session = local ?? remote;
  if (!session || session.project_id !== projectId) return;
  const workspace = local ? await deps.workspaceSessionService.getWorkspaceBySessionId(id) : null;
  const links = local ? await deps.workspaceSessionService.listSessionLinks(id) : [];
  return {
    local: Boolean(local),
    workspace,
    links,
    workspaceId: workspace?.id ?? remote?.workspace_id ?? undefined,
    identity: JSON.stringify([
      Boolean(local),
      session.agent,
      session.agent_session_id,
      session.params_json,
      session.last_selected_model,
      session.cwd,
      workspace,
    ]),
  };
};

export const observeSessionMetadataSources = async (
  deps: ExtensionsRouteDeps,
  projectId: string,
  id: string,
  source: NonNullable<Awaited<ReturnType<typeof readSessionMetadataScope>>>,
  notify: (change: "execution" | "harness" | "workspace") => void,
  own: (stop: () => void) => boolean,
  active: () => boolean,
) => {
  if (!active()) return;
  if (!source.local) {
    const watch = observeSessionAvailability(deps.accountService, () => notify("execution"));
    if (!own(watch.close)) return;
    await watch.ready;
  } else if (!own(await observeSessionHarnessCommands(deps, id, () => notify("harness")).catch(() => () => {}))) return;
  if (!active()) return;
  const workspace = source.workspace;
  if (!workspace || workspace.initializing || workspace.setup_error || !workspace.provider_capabilities_json?.diff)
    return;
  const abort = new AbortController();
  if (!own(() => abort.abort())) return;
  await observeWorkspaceDiff(
    deps,
    { project_id: projectId, workspace_id: workspace.id },
    () => notify("workspace"),
    abort.signal,
  ).catch(() => undefined);
};
