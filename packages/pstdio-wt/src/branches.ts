import { git } from "./git";
import type { BranchInfo } from "./types";

export const listBranches = async (repoRoot: string): Promise<BranchInfo[]> => {
  const output = await git(repoRoot, [
    "branch",
    "-a",
    "--format=%(refname:short)\t%(HEAD)\t%(objecttype)\t%(creatordate:iso8601)",
  ]);

  if (!output) return [];

  return output.split("\n").map((line) => {
    const [name, head, , date] = line.split("\t");
    return {
      name,
      isCurrent: head === "*",
      isRemote: name.startsWith("origin/"),
      lastCommitDate: date ?? "",
    };
  });
};
