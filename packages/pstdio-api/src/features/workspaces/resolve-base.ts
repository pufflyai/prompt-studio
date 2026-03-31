import { git } from "pstdio-wt";

export interface ResolvedBase {
  sha: string;
  label: string;
}

// Workspace branches are created via `git worktree add -b <branch> <path> <base>`.
// The reflog records both the commit SHA and the creation message (e.g. "Created from main").
// We use the oldest reflog entry for the SHA and parse the message for the label.
const resolveBranchForkPoint = async (worktreePath: string) => {
  try {
    const branch = await git(worktreePath, ["rev-parse", "--abbrev-ref", "HEAD"]);
    if (branch === "HEAD") return null;

    const reflog = await git(worktreePath, ["reflog", "show", "--format=%H %gs", branch]);
    const entries = reflog.split("\n").filter(Boolean);
    const oldest = entries[entries.length - 1];
    if (!oldest) return null;

    const sha = oldest.split(" ")[0];

    // Parse "branch: Created from <ref>" to extract the source branch name
    const match = oldest.match(/Created from (.+)/);
    const label = match?.[1] === "HEAD" ? null : (match?.[1] ?? null);

    return { sha, label };
  } catch {
    return null;
  }
};

export const resolveBase = async (worktreePath: string): Promise<ResolvedBase> => {
  // Prefer the reflog fork point — it's the commit this branch was created from,
  // regardless of how far main has moved since.
  const forkPoint = await resolveBranchForkPoint(worktreePath);
  if (forkPoint) {
    return { sha: forkPoint.sha, label: forkPoint.label ?? forkPoint.sha.slice(0, 7) };
  }

  // Fallback: merge-base against default branch
  for (const candidate of ["main", "master"]) {
    try {
      const sha = await git(worktreePath, ["merge-base", "HEAD", candidate]);
      return { sha, label: candidate };
    } catch {
      // branch doesn't exist, try next
    }
  }

  // Last resort: diff against the initial commit
  try {
    const root = await git(worktreePath, ["rev-list", "--max-parents=0", "HEAD"]);
    const sha = root.split("\n")[0];
    return { sha, label: sha.slice(0, 7) };
  } catch {
    return { sha: "HEAD", label: "HEAD" };
  }
};

export const resolveHeadLabel = async (worktreePath: string) => {
  try {
    return await git(worktreePath, ["rev-parse", "--abbrev-ref", "HEAD"]);
  } catch {
    return "HEAD";
  }
};
