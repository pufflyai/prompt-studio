import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { join, relative, resolve } from "node:path";

type PackageJson = {
  dependencies?: Record<string, unknown>;
  name?: string;
  peerDependencies?: Record<string, unknown>;
};

type PrepareManagedWebviewBuildSourceInput = {
  entryPath: string;
  installName: string;
  packageName: string;
  packagePath: string;
  shellDir: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readPackageJson = (packagePath: string): PackageJson => {
  const parsed = JSON.parse(readFileSync(join(packagePath, "package.json"), "utf8")) as unknown;
  if (!isRecord(parsed)) return {};
  return parsed as PackageJson;
};

const packageDependencyNames = (manifest: PackageJson) => [
  ...new Set([...Object.keys(manifest.dependencies ?? {}), ...Object.keys(manifest.peerDependencies ?? {})]),
];

const packagePathInNodeModules = (nodeModulesPath: string, packageName: string) => {
  const [scope, name] = packageName.split("/");
  if (packageName.startsWith("@") && name) return join(nodeModulesPath, scope, name);
  return join(nodeModulesPath, packageName);
};

const hasUsableNodeModules = (nodeModulesPath: string, dependencyNames: string[]) => {
  if (!existsSync(nodeModulesPath)) return false;
  return dependencyNames.every((name) => existsSync(packagePathInNodeModules(nodeModulesPath, name)));
};

const candidateSourceRoots = (installName: string, packageName: string) => {
  const names = [...new Set([installName, packageName])];
  const repoRoots = [process.cwd(), resolve(import.meta.dirname, "../../../../../")];
  return repoRoots.flatMap((root) => names.map((name) => join(root, "extensions", name)));
};

const packageNameMatches = (packagePath: string, packageName: string) => {
  try {
    return readPackageJson(packagePath).name === packageName;
  } catch {
    return false;
  }
};

const canBuildFromPackagePath = (packagePath: string, dependencyNames: string[]) =>
  dependencyNames.length === 0 || hasUsableNodeModules(join(packagePath, "node_modules"), dependencyNames);

const resolveFallbackDependencyNodeModules = (
  packagePath: string,
  installName: string,
  packageName: string,
  dependencyNames: string[],
) => {
  for (const candidate of candidateSourceRoots(installName, packageName)) {
    if (resolve(candidate) === resolve(packagePath)) continue;
    if (!packageNameMatches(candidate, packageName)) continue;

    const candidateNodeModules = join(candidate, "node_modules");
    if (hasUsableNodeModules(candidateNodeModules, dependencyNames)) return candidateNodeModules;
  }

  return null;
};

const symlinkPackageChild = (sourcePath: string, targetPath: string) => {
  const stats = lstatSync(sourcePath);
  symlinkSync(sourcePath, targetPath, stats.isDirectory() ? "junction" : "file");
};

const mirrorPackageSource = (packagePath: string, shellDir: string) => {
  mkdirSync(shellDir, { recursive: true });
  for (const dirent of readdirSync(packagePath, { withFileTypes: true })) {
    if (dirent.name === "node_modules") continue;
    cpSync(join(packagePath, dirent.name), join(shellDir, dirent.name), { recursive: true });
  }
};

export const prepareManagedWebviewBuildSource = (input: PrepareManagedWebviewBuildSourceInput) => {
  const manifest = readPackageJson(input.packagePath);
  const dependencyNames = packageDependencyNames(manifest);
  if (canBuildFromPackagePath(input.packagePath, dependencyNames)) {
    return { entryPath: input.entryPath };
  }

  const dependencyNodeModules = resolveFallbackDependencyNodeModules(
    input.packagePath,
    input.installName,
    input.packageName,
    dependencyNames,
  );

  rmSync(input.shellDir, { recursive: true, force: true });
  mirrorPackageSource(input.packagePath, input.shellDir);
  if (dependencyNodeModules) symlinkPackageChild(dependencyNodeModules, join(input.shellDir, "node_modules"));

  return { entryPath: join(input.shellDir, relative(input.packagePath, input.entryPath)) };
};
