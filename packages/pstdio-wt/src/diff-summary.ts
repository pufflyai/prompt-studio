import { gitBytes } from "./git";

export const readTrackedDiffSummary = async (worktreePath: string, base: string) => {
  const output = await gitBytes(worktreePath, ["diff", "--numstat", "-z", base, "--"]).catch(() => Buffer.alloc(0));
  const records = output.toString().split("\0");
  const paths = new Set<string>();
  let additions = 0;
  let deletions = 0;

  for (let index = 0; index < records.length; index++) {
    const [added, deleted, ...name] = records[index].split("\t");
    if (deleted === undefined) continue;
    let path = name.join("\t");
    if (!path) {
      // With -z a rename has an empty name followed by separate old and new paths.
      index += 2;
      path = records[index];
    }
    if (!path) continue;
    paths.add(path);
    additions += Number.parseInt(added, 10) || 0;
    deletions += Number.parseInt(deleted, 10) || 0;
  }

  return { additions, deletions, paths };
};
