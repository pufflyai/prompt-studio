import { defineWorkspaceType, l10n, params } from "@pstdio/sdk/extensions";
import { discoverGitWorkspace } from "./discovery";
import { deleteWorktree, prepareWorktree, resolveWorktree } from "./lifecycle";
import { localResult } from "./worktree-ref";

export const gitWorkspace = defineWorkspaceType({
  id: "git",
  label: l10n("workspace.git", "Git worktree"),
  icon: "git-branch",
  params: { base: params.text({ label: l10n("params.base", "Base branch"), required: true, defaultValue: "HEAD" }) },
  discover: discoverGitWorkspace,
  create: prepareWorktree,
  resolve: resolveWorktree,
  async cancel(ctx, input) {
    await deleteWorktree(ctx, input);
    return localResult(input.providerRef, "cancelled");
  },
  delete: deleteWorktree,
});
