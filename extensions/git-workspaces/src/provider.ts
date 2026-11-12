import { defineWorkspaceType, l10n, params } from "@pstdio/sdk/extensions";
import { discoverGitWorkspace } from "./discovery";
import { deleteWorktree, prepareWorktree, resolveWorktree } from "./lifecycle";
import { runGitWorkspaceOperation } from "./operation";
import { validateGitParams } from "./validate-params";
import { localResult } from "./worktree-ref";

export const gitWorkspace = defineWorkspaceType({
  id: "git",
  label: l10n("workspace.git", "Git worktree"),
  icon: "git-branch",
  params: { base: params.text({ label: l10n("params.base", "Base branch"), required: true, defaultValue: "HEAD" }) },
  discover: discoverGitWorkspace,
  validateParams: validateGitParams,
  create: (ctx, input) => runGitWorkspaceOperation(input.workspaceId, () => prepareWorktree(ctx, input)),
  resolve: (ctx, input) => runGitWorkspaceOperation(input.workspaceId, () => resolveWorktree(ctx, input)),
  cancel: (ctx, input) =>
    runGitWorkspaceOperation(input.workspaceId, async () => {
      await deleteWorktree(ctx, input);
      return localResult(input.providerRef, "cancelled");
    }),
  delete: (ctx, input) => runGitWorkspaceOperation(input.workspaceId, () => deleteWorktree(ctx, input)),
});
