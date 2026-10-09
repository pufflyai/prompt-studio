import { type Dirent, readdirSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, join, relative } from "node:path";
import { createExtensionIgnoreMatcher, extensionDependencyInputNames } from "pstdio-extensions/authoring";

const uploadEntry = (root: string, path: string, entry: Dirent) => {
  if (!entry.isSymbolicLink()) return entry;
  const destination = relative(root, realpathSync(path));
  if (
    destination === ".." ||
    destination.startsWith("../") ||
    destination.startsWith("..\\") ||
    isAbsolute(destination)
  )
    throw new Error(`Extension link leaves the source folder: ${relative(root, path)}`);
  if (destination.split(/[/\\]/).includes("node_modules")) return null;
  return statSync(path);
};

export const extensionUploadFiles = (root: string) => {
  const matcher = createExtensionIgnoreMatcher(root, { ignoreGit: false });
  const included = (name: string) => {
    if (name.split("/").includes("node_modules")) return false;
    if (name === ".git" || name.startsWith(".git/")) return true;
    if (extensionDependencyInputNames.includes(name as never)) return true;
    return !matcher.ignores(name);
  };
  const files: { path: string; name: string }[] = [];
  const visit = (dir: string, ancestors: Set<string>) => {
    const canonical = realpathSync(dir);
    if (ancestors.has(canonical)) throw new Error("Extension source contains a directory link cycle.");
    const parents = new Set([...ancestors, canonical]);
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      const name = relative(root, path).replaceAll("\\", "/");
      if (!included(name)) continue;
      const kind = uploadEntry(root, path, entry);
      if (kind?.isDirectory()) visit(path, parents);
      else if (kind?.isFile()) files.push({ path, name });
    }
  };
  visit(root, new Set());
  return files;
};
