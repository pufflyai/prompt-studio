import { existsSync, readFileSync, realpathSync, statSync, symlinkSync, unlinkSync } from "node:fs";
import { cp, readdir, realpath, stat } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { mirrorNodeModules } from "pstdio-extensions";

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

  mirrorNodeModules(sourceNodeModules, targetNodeModules);
};

const rebaseCopiedLink = async (
  copied: string,
  source: string,
  target: string,
  sourcePath: string,
  targetPath: string,
) => {
  const original = join(source, relative(target, copied));

  let destination: string;
  try {
    destination = await realpath(original);
  } catch {
    // The workspace link vanished between the copy and this pass. Keep the
    // verbatim link the copy already wrote rather than aborting the install.
    return;
  }

  const sourceRelative = relative(source, destination);
  const inside = !sourceRelative.startsWith("..") && !isAbsolute(sourceRelative);
  const extensionRelative = relative(sourcePath, destination);
  const insideExtension = !extensionRelative.startsWith("..") && !isAbsolute(extensionRelative);
  let rebased = destination;
  if (inside) rebased = relative(dirname(copied), join(target, sourceRelative));
  else if (insideExtension) rebased = relative(dirname(copied), join(targetPath, extensionRelative));

  let isDirectory = true;
  try {
    isDirectory = (await stat(original)).isDirectory();
  } catch {
    // Windows can refuse to follow a store symlink reached through a junction.
    // Assume a package directory (the common case) so the rebased junction still
    // resolves.
  }

  unlinkSync(copied);
  symlinkSync(resolve(dirname(copied), rebased), copied, isDirectory ? "junction" : "file");
};

// Junctions store absolute destinations on Windows. Update links into the moved
// install while retaining links to dependencies owned by a sibling checkout.
export const prepareNodeModulesRelocation = async (sourcePath: string, targetPath: string) => {
  const started = Date.now();
  let directories = 0;
  const nodeModules = join(sourcePath, "node_modules");
  const canonicalSource = realpathSync.native(sourcePath);
  const canonicalTarget = join(realpathSync.native(dirname(targetPath)), basename(targetPath));
  const links: { path: string; destination: string; directory: boolean }[] = [];
  const collect = async (directory: string) => {
    directories++;
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await collect(path);
      if (!entry.isSymbolicLink()) continue;
      const destination = await realpath(path);
      const within = relative(canonicalSource, destination);
      if (within.startsWith("..") || isAbsolute(within)) continue;
      links.push({
        path: join(canonicalTarget, relative(sourcePath, path)),
        destination: join(canonicalTarget, within),
        directory: (await stat(path)).isDirectory(),
      });
    }
  };
  if (existsSync(nodeModules)) await collect(nodeModules);
  console.log("Native relocation scan", Date.now() - started, directories, links.length, sourcePath);
  return () => {
    const started = Date.now();
    for (const { path, destination, directory } of links) {
      unlinkSync(path);
      symlinkSync(destination, path, directory ? "junction" : "file");
    }
    console.log("Native relocation apply", Date.now() - started, links.length, targetPath);
  };
};

export const copyUsableNodeModules = async (sourcePath: string, targetPath: string) => {
  const usable = findUsableNodeModules(sourcePath);
  if (!usable) return;
  // Native realpath expands Windows short names such as RUNNER~1. The JS
  // walker can retain them while resolving file links to a long-name path.
  const source = realpathSync.native(usable);
  const extensionSource = realpathSync.native(sourcePath);
  const target = join(targetPath, "node_modules");
  if (existsSync(target) && realpathSync.native(target) === source) return;
  await cp(source, target, { recursive: true, verbatimSymlinks: true });
  const rebaseLinks = async (directory: string) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const copied = join(directory, entry.name);
      if (entry.isDirectory()) await rebaseLinks(copied);
      if (entry.isSymbolicLink()) await rebaseCopiedLink(copied, source, target, extensionSource, targetPath);
    }
  };
  await rebaseLinks(target);
};
