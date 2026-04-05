import type { PluginHelperContext, WorkspaceRef } from "./context";
import { findWorkspaceByRef } from "./find-workspace-by-ref";

type WorkspaceAttemptStatusInput = WorkspaceRef & {
  statusName: string;
  sessionId?: string;
};

export const setWorkspaceAttemptStatus = async (ctx: PluginHelperContext, input: WorkspaceAttemptStatusInput) => {
  const workspace = await findWorkspaceByRef(ctx, input);
  const workspaceId = workspace?.id;
  if (!workspaceId) return false;

  await ctx.client.workspaces.updateAttemptStatus(workspaceId, {
    status: input.statusName,
    session_id: input.sessionId,
  });
  return true;
};
