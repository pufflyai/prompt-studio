import { git } from "./git";
import type { CommitResult, StagingPolicy } from "./types";

export const commitChanges = async (opts: {
  worktreePath: string;
  message: string;
  stage?: StagingPolicy;
}): Promise<CommitResult> => {
  const cwd = opts.worktreePath;
  const policy = opts.stage ?? "all";

  if (policy === "all") {
    await git(cwd, ["add", "-A"]);
  } else if (policy === "tracked") {
    await git(cwd, ["add", "-u"]);
  }
  // "none" — commit only what's already staged

  await git(cwd, ["commit", "-m", opts.message]);

  const sha = await git(cwd, ["rev-parse", "HEAD"]);

  return { sha, message: opts.message };
};
