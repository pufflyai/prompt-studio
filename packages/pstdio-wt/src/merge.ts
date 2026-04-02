import type { HookPayload } from "pstdio-hooks";
import { runHook } from "pstdio-hooks";
import { GitError, git } from "./git";
import type { MergeResult } from "./types";

export const mergeWorktree = async (opts: {
  repoRoot: string;
  branch: string;
  target?: string;
  squash?: boolean;
  message?: string;
  hookPayload?: HookPayload;
}): Promise<MergeResult> => {
  const target = opts.target ?? (await getCurrentBranch(opts.repoRoot));
  const shouldSquash = opts.squash ?? false;
  const basePayload: HookPayload = {
    repo_path: opts.repoRoot,
    branch: opts.branch,
    target,
    squash: shouldSquash,
    commit_message: opts.message ?? null,
    ...opts.hookPayload,
  };

  const preResult = await runHook("pre-merge", basePayload, { repoPath: opts.repoRoot });
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
    const conflictPayload: HookPayload = {
      ...basePayload,
      operation: "merge",
    };
    void runHook("on-conflict", conflictPayload, { repoPath: opts.repoRoot }).catch(() => {});

    if (err instanceof GitError) {
      throw new Error(`Merge of ${opts.branch} into ${target} failed: ${err.stderr}`);
    }
    throw err;
  }

  const sha = await git(opts.repoRoot, ["rev-parse", "HEAD"]);

  void runHook("post-merge", { ...basePayload, commit_sha: sha }, { repoPath: opts.repoRoot }).catch(() => {});

  return { merged: true, target, sha };
};

const getCurrentBranch = async (repoRoot: string) => {
  return git(repoRoot, ["symbolic-ref", "--short", "HEAD"]);
};
