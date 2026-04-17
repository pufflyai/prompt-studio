import { git } from "./git";

const tryFetch = async (repoRoot: string, remote: string, branch: string) => {
  try {
    await git(repoRoot, ["fetch", remote, branch]);
  } catch {
    // remote unreachable — proceed with whatever refs we already have
  }
};

const refExists = async (repoRoot: string, ref: string) => {
  try {
    await git(repoRoot, ["rev-parse", "--verify", ref]);
    return true;
  } catch {
    return false;
  }
};

const splitRemoteRef = (ref: string) => {
  const idx = ref.indexOf("/");
  if (idx < 1) return null;
  return { remote: ref.slice(0, idx), branch: ref.slice(idx + 1) };
};

const getUpstream = async (repoRoot: string, branch: string) => {
  try {
    return await git(repoRoot, ["rev-parse", "--abbrev-ref", `${branch}@{upstream}`]);
  } catch {
    return null;
  }
};

// Picks the freshest usable ref for a new worktree's starting point.
// Pass-through for "HEAD" and refs that are already remote-tracking — those
// already reflect user intent (after a best-effort fetch). For a plain branch,
// consult git's own upstream tracking config: fetch that upstream and prefer
// it when local is behind or equal, so a worktree doesn't start from a stale
// local ref. Falls back to the local branch when local is ahead, diverged, or
// when the branch has no upstream (local-only repos or untracked branches) —
// so in-progress local commits aren't silently dropped.
export const resolveLatestBase = async (repoRoot: string, base: string) => {
  if (base === "HEAD") return base;

  if (await refExists(repoRoot, `refs/remotes/${base}`)) {
    const parts = splitRemoteRef(base);
    if (parts) await tryFetch(repoRoot, parts.remote, parts.branch);
    return base;
  }

  const upstream = await getUpstream(repoRoot, base);
  if (!upstream) return base;

  const parts = splitRemoteRef(upstream);
  if (parts) await tryFetch(repoRoot, parts.remote, parts.branch);

  try {
    await git(repoRoot, ["merge-base", "--is-ancestor", base, upstream]);
    return upstream;
  } catch {
    return base;
  }
};
