import { GitError, git } from "./git";
import { runHook } from "./hooks";
import type { HookContext, MergeResult } from "./types";

export const mergeWorktree = async (opts: {
  repoRoot: string;
  branch: string;
  target?: string;
  squash?: boolean;
  message?: string;
  hookContext?: Partial<HookContext>;
}): Promise<MergeResult> => {
  const target = opts.target ?? (await getCurrentBranch(opts.repoRoot));
  const shouldSquash = opts.squash ?? false;

  const baseContext: HookContext = {
    repoPath: opts.repoRoot,
    branch: opts.branch,
    target,
    ...opts.hookContext,
  };

  const preResult = await runHook("pre-merge", baseContext, opts.repoRoot);
  if (!preResult.skipped && preResult.exitCode !== 0) {
    throw new Error(`HOOK pre-merge FAILED (exit ${preResult.exitCode})\n${preResult.stderr || preResult.stdout}`);
  }

  // ensure we're on the target branch
  const currentBranch = await getCurrentBranch(opts.repoRoot);
  if (currentBranch !== target) {
    await git(opts.repoRoot, ["checkout", target]);
  }

  try {
    if (shouldSquash) {
      await git(opts.repoRoot, ["merge", "--squash", opts.branch]);
      const msg = opts.message ?? `merge ${opts.branch}`;
      await git(opts.repoRoot, ["commit", "-m", msg]);
    } else {
      await git(opts.repoRoot, ["merge", "--ff-only", opts.branch]);
    }
  } catch (err) {
    void runHook("on-conflict", baseContext, opts.repoRoot).catch(() => {});

    if (err instanceof GitError) {
      throw new Error(`Merge of ${opts.branch} into ${target} failed: ${err.stderr}`);
    }
    throw err;
  }

  const sha = await git(opts.repoRoot, ["rev-parse", "HEAD"]);

  void runHook("post-merge", { ...baseContext, commitSha: sha }, opts.repoRoot).catch(() => {});

  return { merged: true, target, sha };
};

const getCurrentBranch = async (repoRoot: string) => {
  return git(repoRoot, ["symbolic-ref", "--short", "HEAD"]);
};
