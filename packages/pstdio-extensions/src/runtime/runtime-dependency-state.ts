import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { collectRuntimePackageImports } from "./runtime-source-snapshot";

const runtimeDependencyNames = (contents: string) => {
  try {
    const manifest = JSON.parse(contents);
    return [
      ...new Set<string>([
        ...Object.keys(manifest.dependencies ?? {}),
        ...Object.keys(manifest.optionalDependencies ?? {}),
        ...Object.keys(manifest.peerDependencies ?? {}),
      ]),
    ].sort();
  } catch {
    return [];
  }
};

const findDependency = (name: string, importer: string | null, nodeModulesPath: string | null) => {
  let current = importer;
  while (current) {
    const path = join(current, "node_modules", name);
    if (existsSync(path)) return path;
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  const path = nodeModulesPath ? join(nodeModulesPath, name) : null;
  return path && existsSync(path) ? path : null;
};

// Package installation changes are owned by runtime dependency manifests, not every
// package sharing node_modules. Read fresh manifests and links so repairs invalidate
// failed loads without relying on the JavaScript resolver's process-wide cache.
export const runtimeDependencyState = (
  packagePath: string,
  modulePaths: Set<string>,
  nodeModulesPath: string | null,
) => {
  const hash = createHash("sha256");
  const names = new Set([
    ...runtimeDependencyNames(readFileSync(join(packagePath, "package.json"), "utf8")),
    ...collectRuntimePackageImports(packagePath, modulePaths),
  ]);
  const pending = [...names].sort().map((name) => ({ name, importer: null as string | null }));
  const visited = new Set<string>();

  while (pending.length) {
    const dependency = pending.pop();
    if (!dependency) continue;
    const path = findDependency(dependency.name, dependency.importer, nodeModulesPath);
    hash.update(`${dependency.importer ?? "extension"}\0${dependency.name}\0`);
    if (!path) {
      hash.update("missing\0");
      continue;
    }
    const realPath = realpathSync(path);
    hash.update(`${realPath}\0`);
    if (visited.has(realPath)) continue;
    visited.add(realPath);
    const manifestPath = join(realPath, "package.json");
    if (!existsSync(manifestPath)) continue;
    const contents = readFileSync(manifestPath, "utf8");
    hash.update(`${contents}\0`);
    pending.push(...runtimeDependencyNames(contents).map((name) => ({ name, importer: realPath })));
  }

  return hash.digest("hex").slice(0, 16);
};
