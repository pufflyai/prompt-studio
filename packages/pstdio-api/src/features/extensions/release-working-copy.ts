import { existsSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { hashRevisionSource } from "pstdio-extensions/revision-dependencies";

const hasEditableDependencies = (path: string) => {
  for (let directory = path; ; directory = dirname(directory)) {
    if (existsSync(join(directory, "node_modules"))) return true;
    if (dirname(directory) === directory) return false;
  }
};

export const matchesPreparedReleaseSource = (input: { sourcePath: string; packagePath: string }) => {
  try {
    const source = realpathSync(input.sourcePath);
    // Keep the normal freshness check when local dependency edits can affect the build.
    if (hasEditableDependencies(input.sourcePath) || hasEditableDependencies(source)) return false;
    return (
      hashRevisionSource(source) ===
      hashRevisionSource(input.packagePath, (path) => path !== ".pstdio-release-runtime.mjs")
    );
  } catch {
    return false;
  }
};
