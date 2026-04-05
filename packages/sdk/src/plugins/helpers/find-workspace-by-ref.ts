import { firstMatch, type PluginHelperContext, readWorkspaceFromContext, type WorkspaceRef } from "./context";

export const findWorkspaceByRef = async (ctx: PluginHelperContext, input: WorkspaceRef) => {
  const contextualWorkspace = readWorkspaceFromContext(ctx, input.workspaceId);
  if (contextualWorkspace) return contextualWorkspace;

  const workspaces = await ctx.client.workspaces.list(ctx.projectId);
  return firstMatch(workspaces, input.workspaceId, (workspace) => workspace.workspace_shorthand);
};
