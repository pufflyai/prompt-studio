import { GitError, git } from "./git";
import type { RebaseResult } from "./types";
import { findWorktreeByBranch } from "./worktree";

export const rebaseOntoTarget = async (opts: {
  repoRoot: string;
  branch: string;
  target?: string;
}): Promise<RebaseResult> => {
  const target = opts.target ?? (await git(opts.repoRoot, ["symbolic-ref", "--short", "HEAD"]));

  // check if branch is already up-to-date with target
  const mergeBase = await git(opts.repoRoot, ["merge-base", target, opts.branch]);
  const targetSha = await git(opts.repoRoot, ["rev-parse", target]);
  const upToDate = mergeBase === targetSha;

  if (upToDate) {
    return { rebased: true, upToDate: true };
  }

  // resolve the worktree path for this branch — rebase must run inside the worktree
  // because `git rebase target branch` does a checkout which fails for worktree branches
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
    if (err instanceof GitError) {
      throw new Error(`Rebase of ${opts.branch} onto ${target} failed: ${err.stderr}`);
    }
    throw err;
  }

  return { rebased: true, upToDate: false };
};
