import { existsSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";

export const hasGitDiscoveryContext = (root: string) => {
  // Explicit Git environments can name administration outside the working folder.
  if (["GIT_DIR", "GIT_COMMON_DIR", "GIT_WORK_TREE", "GIT_OBJECT_DIRECTORY"].some((name) => process.env[name]))
    return true;
  for (let directory = realpathSync(root); ; directory = dirname(directory)) {
    // Linked worktrees use a .git file; bare repositories keep HEAD and objects in their root.
    if (existsSync(join(directory, ".git"))) return true;
    if (existsSync(join(directory, "HEAD")) && existsSync(join(directory, "objects"))) return true;
    if (dirname(directory) === directory) return false;
  }
};
