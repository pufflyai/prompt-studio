import { git } from "./git";
import type { CommitResult, HookDispatch, StagingPolicy } from "./types";

export const commitChanges = async (opts: {
  worktreePath: string;
  message: string;
  stage?: StagingPolicy;
  repoPath?: string;
  dispatch?: HookDispatch;
  log?: (msg: string) => void;
}): Promise<CommitResult> => {
  const cwd = opts.worktreePath;
  const policy = opts.stage ?? "all";
  const repoPath = opts.repoPath ?? opts.worktreePath;
  const dispatch = opts.dispatch;
  const log = opts.log ?? console.log;

  const ctx = {
    repoPath,
    worktreePath: opts.worktreePath,
    commitMessage: opts.message,
    stagePolicy: policy,
  };

  if (dispatch) {
    const preResult = await dispatch.firePreHook("preCommit", ctx);
    if (preResult.rejected) {
      throw new Error(`HOOK preCommit FAILED\n${preResult.reason ?? ""}`);
    }
  }

  if (policy === "all") {
    await git(cwd, ["add", "-A"]);
  } else if (policy === "tracked") {
    await git(cwd, ["add", "-u"]);
  }

  await git(cwd, ["commit", "-m", opts.message]);

  const sha = await git(cwd, ["rev-parse", "HEAD"]);

  if (dispatch) {
    void dispatch.firePostHook("postCommit", { ...ctx, commitSha: sha }, (message) => {
      log(`postCommit hook failed: ${message}`);
    });
  }

  return { sha, message: opts.message };
};
