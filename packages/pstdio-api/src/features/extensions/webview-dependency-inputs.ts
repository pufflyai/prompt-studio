import { createHash } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import {
  collectRevisionDependencies,
  hashRevisionDependencies,
  hashRevisionDependenciesAsync,
  hashRevisionSource,
} from "pstdio-extensions/revision-dependencies";

const lockfiles = new Set([
  "bun.lock",
  "bun.lockb",
  "package-lock.json",
  "npm-shrinkwrap.json",
  "pnpm-lock.yaml",
  "yarn.lock",
]);
// The manifest and used declarations have their own normalized build signature.
// Resolved dependency bytes, rather than unused declarations or locks, name output.
const includeOwnInput = (path: string) => path !== "package.json" && !lockfiles.has(path);
const hashInputs = (
  packagePath: string,
  packages: ReturnType<typeof collectRevisionDependencies>,
  dependencyHash: string,
) => {
  const root = realpathSync(packagePath);
  const source = packages.get(root)!;
  const hash = createHash("sha256").update(dependencyHash);
  if (source.allFiles) hash.update(hashRevisionSource(packagePath, includeOwnInput));
  else
    for (const rel of [...source.files].filter(includeOwnInput).sort()) {
      hash.update(rel);
      hash.update("\0");
      hash.update(packages.contents.get(join(root, rel)) ?? readFileSync(join(root, rel)));
      hash.update("\0");
    }
  return hash.digest("hex");
};
export const hashWebviewDependencyInputs = (packagePath: string, entryPaths: string[]) => {
  const packages = collectRevisionDependencies(packagePath, { entryPaths, target: "browser" });
  return hashInputs(packagePath, packages, hashRevisionDependencies(packages, packagePath));
};
export const hashWebviewDependencyInputsAsync = async (packagePath: string, entryPaths: string[]) => {
  const packages = collectRevisionDependencies(packagePath, { entryPaths, target: "browser" });
  return hashInputs(packagePath, packages, await hashRevisionDependenciesAsync(packages, packagePath));
};
