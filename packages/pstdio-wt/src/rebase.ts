import { GitError, git } from "./git";
import { runHook } from "./hooks";
import type { HookContext, RebaseResult } from "./types";
import { findWorktreeByBranch } from "./worktree";

export const rebaseOntoTarget = async (opts: {
  repoRoot: string;
  branch: string;
  target?: string;
  hookContext?: Partial<HookContext>;
}): Promise<RebaseResult> => {
  const target = opts.target ?? (await git(opts.repoRoot, ["symbolic-ref", "--short", "HEAD"]));

  // check if branch is already up-to-date with target
  const mergeBase = await git(opts.repoRoot, ["merge-base", target, opts.branch]);
  const targetSha = await git(opts.repoRoot, ["rev-parse", target]);
  const upToDate = mergeBase === targetSha;

  if (upToDate) {
    return { rebased: true, upToDate: true };
  }

  const baseContext: HookContext = {
    repoPath: opts.repoRoot,
    branch: opts.branch,
    target,
    ...opts.hookContext,
  };

  const preResult = await runHook("pre-rebase", baseContext, opts.repoRoot);
  if (!preResult.skipped && preResult.exitCode !== 0) {
    throw new Error(`HOOK pre-rebase FAILED (exit ${preResult.exitCode})\n${preResult.stderr || preResult.stdout}`);
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
    void runHook("on-conflict", baseContext, opts.repoRoot).catch(() => {});
    if (err instanceof GitError) {
      throw new Error(`Rebase of ${opts.branch} onto ${target} failed: ${err.stderr}`);
    }
    throw err;
  }

  void runHook("post-rebase", baseContext, opts.repoRoot).catch(() => {});

  return { rebased: true, upToDate: false };
};
