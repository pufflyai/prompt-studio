import { existsSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { collectRevisionDependencies, hashRevisionSource } from "pstdio-extensions/revision-dependencies";

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
    const entries: string[] = [];
    const sourceHash = hashRevisionSource(source, (path) => {
      // Include every possible script/CSS entry, including frontend-only package assets.
      if (/\.(?:[cm]?[jt]sx?|css)$/.test(path) && path !== ".pstdio-release-runtime.mjs")
        entries.push(join(source, path));
      return true;
    });
    const dependencies = collectRevisionDependencies(source, {
      entryPaths: entries.length ? entries : undefined,
      target: "browser",
    });
    const insideSource = (path: string) => {
      const rel = relative(source, path);
      return rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
    };
    if (
      dependencies.size !== 1 ||
      [...dependencies.get(source)!.files].some((path) => !insideSource(resolve(source, path))) ||
      [...dependencies.compilerInputs].some(([path, input]) => !insideSource(path) || input.opaque)
    )
      return false;
    return sourceHash === hashRevisionSource(input.packagePath, (path) => path !== ".pstdio-release-runtime.mjs");
  } catch {
    return false;
  }
};
