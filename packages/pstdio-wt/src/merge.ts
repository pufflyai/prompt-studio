import { GitError, git } from "./git";
import type { HookDispatch, MergeResult } from "./types";

export const mergeWorktree = async (opts: {
  repoRoot: string;
  branch: string;
  target?: string;
  squash?: boolean;
  message?: string;
  dispatch?: HookDispatch;
}): Promise<MergeResult> => {
  const target = opts.target ?? (await getCurrentBranch(opts.repoRoot));
  const shouldSquash = opts.squash ?? false;
  const dispatch = opts.dispatch;

  const ctx = {
    repoPath: opts.repoRoot,
    branch: opts.branch,
    target,
    squash: shouldSquash,
    commitMessage: opts.message ?? null,
  };

  if (dispatch) {
    const preResult = await dispatch.firePreHook("preMerge", ctx);
    if (preResult.rejected) {
      throw new Error(`HOOK preMerge FAILED\n${preResult.reason ?? ""}`);
    }
  }

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
    if (dispatch) {
      void dispatch.firePostHook("onConflict", { ...ctx, operation: "merge" as const }).catch(() => {});
    }
    if (err instanceof GitError) {
      throw new Error(`Merge of ${opts.branch} into ${target} failed: ${err.stderr}`);
    }
    throw err;
  }

  const sha = await git(opts.repoRoot, ["rev-parse", "HEAD"]);

  if (dispatch) {
    void dispatch.firePostHook("postMerge", { ...ctx, commitSha: sha }).catch(() => {});
  }

  return { merged: true, target, sha };
};

const getCurrentBranch = async (repoRoot: string) => {
  return git(repoRoot, ["symbolic-ref", "--short", "HEAD"]);
};
