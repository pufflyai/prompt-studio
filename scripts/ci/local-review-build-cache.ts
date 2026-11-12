import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { createBuildCache } from "./build-cache";

export const startLocalReviewBuildCache = (root: string) => {
  const common = execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], {
    cwd: root,
    encoding: "utf8",
    timeout: 10000,
  }).trim();
  // Worktrees share immutable archives, never Nx's SQLite database or restored outputs.
  // Nx additionally hashes sources, transitive inputs, build configuration and toolchain runtimes.
  const directory = join(common, "pstdio-local-review-builds", "v1", `${process.platform}-${process.arch}`);
  const statistics = { hits: 0, misses: 0, stored: 0, existing: 0 };
  try {
    const server = createBuildCache(directory, statistics);
    return { directory, statistics, server, error: undefined };
  } catch (error) {
    // Cache availability is an optimization; a cold build remains valid.
    return { directory, statistics, server: undefined, error: String(error) };
  }
};
