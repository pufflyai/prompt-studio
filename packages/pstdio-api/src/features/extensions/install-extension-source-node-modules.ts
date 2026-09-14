import {
  cpSync,
  existsSync,
  lstatSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  statSync,
  symlinkSync,
  unlinkSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

const dependencyPath = (nodeModulesPath: string, dependencyName: string) =>
  dependencyName.startsWith("@")
    ? join(nodeModulesPath, ...dependencyName.split("/"))
    : join(nodeModulesPath, dependencyName);

const runtimeDependencyNames = (sourcePath: string) => {
  const parsed = JSON.parse(readFileSync(join(sourcePath, "package.json"), "utf8")) as {
    dependencies?: Record<string, unknown>;
  };
  return Object.keys(parsed.dependencies ?? {});
};

export const hasLocalDirectoryDependencies = (sourcePath: string) => {
  const manifest = JSON.parse(readFileSync(join(sourcePath, "package.json"), "utf8"));
  return Object.values({
    ...manifest.dependencies,
    ...manifest.devDependencies,
    ...manifest.optionalDependencies,
  }).some((specifier) => {
    if (typeof specifier !== "string" || !/^(file:|link:|\.\.?\/|\/)/.test(specifier)) return false;
    const dependency = resolve(sourcePath, specifier.replace(/^(file:|link:)/, ""));
    return existsSync(dependency) && statSync(dependency).isDirectory();
  });
};

const hasDependencies = (nodeModulesPath: string, dependencyNames: string[]) =>
  dependencyNames.every((dependencyName) => existsSync(dependencyPath(nodeModulesPath, dependencyName)));

const findUsableNodeModules = (sourcePath: string) => {
  const dependencyNames = runtimeDependencyNames(sourcePath);
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
  if (!sourceNodeModules || existsSync(targetNodeModules)) return;

  symlinkSync(sourceNodeModules, targetNodeModules, lstatSync(sourceNodeModules).isDirectory() ? "junction" : "file");
};

const rebaseCopiedLink = (copied: string, source: string, target: string) => {
  const original = join(source, relative(target, copied));

  let linkText: string;
  try {
    linkText = readlinkSync(original);
  } catch {
    // The workspace link vanished between the copy and this pass. Keep the
    // verbatim link cpSync already wrote rather than aborting the install.
    return;
  }

  const destination = resolve(dirname(original), linkText);
  const sourceRelative = relative(source, destination);
  const inside = !sourceRelative.startsWith("..") && !isAbsolute(sourceRelative);
  const rebased = inside ? relative(dirname(copied), join(target, sourceRelative)) : destination;

  let isDirectory = true;
  try {
    isDirectory = statSync(original).isDirectory();
  } catch {
    // Windows can refuse to follow a store symlink reached through a junction.
    // Assume a package directory (the common case) so the rebased junction still
    // resolves.
  }

  unlinkSync(copied);
  symlinkSync(rebased, copied, isDirectory ? "junction" : "file");
};

export const copyUsableNodeModules = (sourcePath: string, targetPath: string) => {
  const usable = findUsableNodeModules(sourcePath);
  if (!usable) return;
  const source = realpathSync(usable);
  const target = join(targetPath, "node_modules");
  if (existsSync(target) && realpathSync(target) === source) return;
  cpSync(source, target, { recursive: true, verbatimSymlinks: true });
  const rebaseLinks = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const copied = join(directory, entry.name);
      if (entry.isDirectory()) rebaseLinks(copied);
      if (entry.isSymbolicLink()) rebaseCopiedLink(copied, source, target);
    }
  };
  rebaseLinks(target);
};
