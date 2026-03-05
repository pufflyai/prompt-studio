import { GitError, git } from "./git";
import type { MergeResult } from "./types";

export const mergeWorktree = async (opts: {
  repoRoot: string;
  branch: string;
  target?: string;
  squash?: boolean;
  message?: string;
}): Promise<MergeResult> => {
  const target = opts.target ?? (await getCurrentBranch(opts.repoRoot));
  const shouldSquash = opts.squash ?? false;

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
    if (err instanceof GitError) {
      throw new Error(`Merge of ${opts.branch} into ${target} failed: ${err.stderr}`);
    }
    throw err;
  }

  const sha = await git(opts.repoRoot, ["rev-parse", "HEAD"]);

  return { merged: true, target, sha };
};

const getCurrentBranch = async (repoRoot: string) => {
  return git(repoRoot, ["symbolic-ref", "--short", "HEAD"]);
};
