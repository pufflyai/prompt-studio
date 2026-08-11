import { existsSync, lstatSync, readFileSync, symlinkSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const dependencyPath = (nodeModulesPath: string, dependencyName: string) =>
  dependencyName.startsWith("@")
    ? join(nodeModulesPath, ...dependencyName.split("/"))
    : join(nodeModulesPath, dependencyName);

const runtimeDependencies = (sourcePath: string) => {
  const parsed = JSON.parse(readFileSync(join(sourcePath, "package.json"), "utf8")) as {
    dependencies?: Record<string, unknown>;
  };
  return Object.entries(parsed.dependencies ?? {});
};

const hasDependencies = (nodeModulesPath: string, dependencyNames: string[]) =>
  dependencyNames.every((dependencyName) => existsSync(dependencyPath(nodeModulesPath, dependencyName)));

const findUsableNodeModules = (sourcePath: string) => {
  const dependencyNames = runtimeDependencies(sourcePath).map(([name]) => name);
  if (dependencyNames.length === 0) return null;

  let current = resolve(sourcePath);

  while (true) {
    const candidate = join(current, "node_modules");
    if (existsSync(candidate) && hasDependencies(candidate, dependencyNames)) return candidate;

    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
};

export const linkUsableNodeModules = (sourcePath: string, targetPath: string) => {
  const sourceNodeModules = findUsableNodeModules(sourcePath);
  const targetNodeModules = join(targetPath, "node_modules");
  if (!sourceNodeModules || existsSync(targetNodeModules)) return false;

  symlinkSync(sourceNodeModules, targetNodeModules, lstatSync(sourceNodeModules).isDirectory() ? "junction" : "file");
  return true;
};

export const linkWorkspaceNodeModules = (sourcePath: string, targetPath: string) => {
  const usesWorkspaceDependency = runtimeDependencies(sourcePath).some(
    ([, version]) => typeof version === "string" && version.startsWith("workspace:"),
  );
  return usesWorkspaceDependency && linkUsableNodeModules(sourcePath, targetPath);
};
