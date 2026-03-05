import { git } from "./git";
import type { WorktreeStatus } from "./types";

export const getWorktreeStatus = async (opts: {
  repoRoot: string;
  worktreePath: string;
  base?: string;
}): Promise<WorktreeStatus> => {
  const cwd = opts.worktreePath;

  const branch = await git(cwd, ["symbolic-ref", "--short", "HEAD"]).catch(() => "(detached)");
  const dirty = (await git(cwd, ["status", "--porcelain"])) !== "";
  const conflicts = (await git(cwd, ["diff", "--name-only", "--diff-filter=U"])) !== "";

  const lastCommitSha = await git(cwd, ["rev-parse", "HEAD"]);
  const lastCommitMessage = await git(cwd, ["log", "-1", "--format=%s"]);

  let aheadOfBase = 0;
  let behindBase = 0;

  try {
    const baseRef = opts.base ?? (await getDefaultBase(opts.repoRoot));
    const counts = await git(cwd, ["rev-list", "--left-right", "--count", `${baseRef}...HEAD`]);
    const [behind, ahead] = counts.split("\t").map(Number);
    aheadOfBase = ahead;
    behindBase = behind;
  } catch {
    // base ref may not exist — leave at 0
  }

  return {
    branch,
    path: cwd,
    dirty,
    conflicts,
    aheadOfBase,
    behindBase,
    lastCommitSha,
    lastCommitMessage,
  };
};

const getDefaultBase = async (repoRoot: string) => {
  try {
    const ref = await git(repoRoot, ["symbolic-ref", "refs/remotes/origin/HEAD"]);
    return ref.replace("refs/remotes/origin/", "");
  } catch {
    return "main";
  }
};
