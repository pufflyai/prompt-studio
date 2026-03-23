import { git } from "pstdio-wt";

// Workspace branches are created via `git worktree add -b <branch> <path> <base>`.
// The reflog records the commit the branch was created from. Use that as the fork
// point so the diff only shows workspace changes — not unrelated main-branch movement.
const resolveBranchForkPoint = async (worktreePath: string) => {
  try {
    const branch = await git(worktreePath, ["rev-parse", "--abbrev-ref", "HEAD"]);
    if (branch === "HEAD") return null;

    const reflog = await git(worktreePath, ["reflog", "show", "--format=%H", branch]);
    const entries = reflog.split("\n").filter(Boolean);
    return entries[entries.length - 1] ?? null;
  } catch {
    return null;
  }
};

export const resolveBase = async (worktreePath: string) => {
  // Prefer the reflog fork point — it's the commit this branch was created from,
  // regardless of how far main has moved since.
  const forkPoint = await resolveBranchForkPoint(worktreePath);
  if (forkPoint) return forkPoint;

  // Fallback: merge-base against default branch
  for (const candidate of ["main", "master"]) {
    try {
      return await git(worktreePath, ["merge-base", "HEAD", candidate]);
    } catch {
      // branch doesn't exist, try next
    }
  }

  // Last resort: diff against the initial commit
  try {
    const root = await git(worktreePath, ["rev-list", "--max-parents=0", "HEAD"]);
    return root.split("\n")[0];
  } catch {
    return "HEAD";
  }
};
