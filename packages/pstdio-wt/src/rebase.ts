import { GitError, git } from "./git";
import type { HookDispatch, RebaseResult } from "./types";
import { findWorktreeByBranch } from "./worktree";

export const rebaseOntoTarget = async (opts: {
  repoRoot: string;
  branch: string;
  target?: string;
  dispatch?: HookDispatch;
}): Promise<RebaseResult> => {
  const target = opts.target ?? (await git(opts.repoRoot, ["symbolic-ref", "--short", "HEAD"]));
  const dispatch = opts.dispatch;

  const mergeBase = await git(opts.repoRoot, ["merge-base", target, opts.branch]);
  const targetSha = await git(opts.repoRoot, ["rev-parse", target]);
  const upToDate = mergeBase === targetSha;

  if (upToDate) {
    return { rebased: true, upToDate: true };
  }

  const ctx = {
    repoPath: opts.repoRoot,
    branch: opts.branch,
    target,
  };

  if (dispatch) {
    const preResult = await dispatch.firePreHook("preRebase", ctx);
    if (preResult.rejected) {
      throw new Error(`HOOK preRebase FAILED\n${preResult.reason ?? ""}`);
    }
  }

  const wt = await findWorktreeByBranch(opts.repoRoot, opts.branch);
  const cwd = wt?.worktree ?? opts.repoRoot;

  try {
    await git(cwd, ["rebase", target]);
  } catch (err) {
    try {
      await git(cwd, ["rebase", "--abort"]);
    } catch {
      // may fail if rebase didn't start
    }
    if (dispatch) {
      void dispatch.firePostHook("onConflict", { ...ctx, operation: "rebase" as const }).catch(() => {});
    }
    if (err instanceof GitError) {
      throw new Error(`Rebase of ${opts.branch} onto ${target} failed: ${err.stderr}`);
    }
    throw err;
  }

  if (dispatch) {
    void dispatch.firePostHook("postRebase", ctx).catch(() => {});
  }

  return { rebased: true, upToDate: false };
};
