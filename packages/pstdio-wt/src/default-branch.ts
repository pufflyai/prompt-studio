import { git } from "./git";

export const getDefaultBranch = async (repoRoot: string) => {
  try {
    const ref = await git(repoRoot, ["symbolic-ref", "refs/remotes/origin/HEAD"]);
    return ref.replace("refs/remotes/origin/", "");
  } catch {
    // fallback: check common branch names
    for (const candidate of ["main", "master"]) {
      try {
        await git(repoRoot, ["rev-parse", "--verify", candidate]);
        return candidate;
      } catch {}
    }
    throw new Error("Could not determine default branch");
  }
};
