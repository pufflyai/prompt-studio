import type { ExtensionSessionQuery } from "pstdio-api-contracts/extension-kernel";
import { createReadBoundary } from "pstdio-extensions";
import { queryReadableSessions } from "../../services/personal-history/queries";
import type { SessionsRouteDeps } from "./deps";
import { toExtensionSession } from "./extension-session";

export class SessionQueryWorkspaceNotFound extends Error {
  constructor(id: string) {
    super(`Workspace not found: ${id}`);
  }
}

export const queryExtensionSessions = async (
  deps: Pick<SessionsRouteDeps, "sessionService" | "workspaceService" | "personalHistoryService">,
  projectId: string,
  input: ExtensionSessionQuery = {},
  signal?: AbortSignal,
) => {
  const read = createReadBoundary(signal);
  let workspaceId: string | undefined;
  if (input.workspaceId) {
    let workspace:
      | Awaited<ReturnType<typeof deps.workspaceService.get>>
      | Awaited<ReturnType<typeof deps.personalHistoryService.getWorkspace>> = await read(() =>
      deps.workspaceService.get(input.workspaceId!),
    );
    if (workspace?.project_id !== projectId)
      workspace = await read(() => deps.workspaceService.getByShorthand(projectId, input.workspaceId!));
    if (!workspace) workspace = await deps.personalHistoryService.getWorkspace(input.workspaceId, projectId);
    if (!workspace) workspace = await deps.personalHistoryService.getWorkspaceByShorthand(projectId, input.workspaceId);
    if (!workspace || workspace.project_id !== projectId) throw new SessionQueryWorkspaceNotFound(input.workspaceId);
    workspaceId = workspace.id;
  }
  const page = await read(() => queryReadableSessions(deps, projectId, { ...input, workspaceId }));
  return { items: page.rows.map((row) => toExtensionSession(row, row.workspace_id)), nextCursor: page.nextCursor };
};
