import { git } from "./git";
import { runHook } from "./hooks";
import type { CommitResult, HookContext, StagingPolicy } from "./types";

export const commitChanges = async (opts: {
  worktreePath: string;
  message: string;
  stage?: StagingPolicy;
  repoPath?: string;
  hookContext?: Partial<HookContext>;
}): Promise<CommitResult> => {
  const cwd = opts.worktreePath;
  const policy = opts.stage ?? "all";
  const repoPath = opts.repoPath ?? opts.worktreePath;

  const baseContext: HookContext = {
    repoPath,
    worktreePath: opts.worktreePath,
    commitMessage: opts.message,
    ...opts.hookContext,
  };

  const preResult = await runHook("pre-commit", baseContext, repoPath);
  if (!preResult.skipped && preResult.exitCode !== 0) {
    throw new Error(`HOOK pre-commit FAILED (exit ${preResult.exitCode})\n${preResult.stderr || preResult.stdout}`);
  }

  if (policy === "all") {
    await git(cwd, ["add", "-A"]);
  } else if (policy === "tracked") {
    await git(cwd, ["add", "-u"]);
  }
  // "none" — commit only what's already staged

  await git(cwd, ["commit", "-m", opts.message]);

  const sha = await git(cwd, ["rev-parse", "HEAD"]);

  void runHook("post-commit", { ...baseContext, commitSha: sha }, repoPath).catch(() => {});

  return { sha, message: opts.message };
};
