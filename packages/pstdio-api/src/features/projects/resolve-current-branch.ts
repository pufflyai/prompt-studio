import { listBranches } from "pstdio-wt";

// Linked folders need not be Git repositories.
export const resolveCurrentBranch = async (repoPath: string) => {
  try {
    const branches = await listBranches(repoPath);
    return branches.find((branch) => branch.isCurrent)?.name ?? null;
  } catch {
    return null;
  }
};
