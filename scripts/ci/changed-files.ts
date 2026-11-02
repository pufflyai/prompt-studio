import { execFileSync } from "node:child_process";

export const changedFiles = (root: string, base?: string) =>
  execFileSync(
    "git",
    ["diff", "--name-only", "--no-renames", "-z", ...(base ? [`${base}...HEAD`] : ["HEAD~1", "HEAD"])],
    {
      cwd: root,
      encoding: "utf8",
    },
  )
    .split("\0")
    .filter(Boolean);
