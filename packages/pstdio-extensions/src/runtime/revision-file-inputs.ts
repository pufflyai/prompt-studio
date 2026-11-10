import { createHash } from "node:crypto";
import { constants, copyFileSync, mkdirSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";

export const visitRevisionFiles = (root: string, visit: (path: string, rel: string) => void) => {
  const directories = new Set<string>();
  const walk = (directory: string) => {
    const canonical = realpathSync(directory);
    if (directories.has(canonical)) return;
    directories.add(canonical);
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name === "node_modules" || entry.name === ".git" || entry.name.startsWith(".pstdio-runtime-")) continue;
      const path = join(directory, entry.name);
      const stats = entry.isSymbolicLink() ? statSync(path, { throwIfNoEntry: false }) : entry;
      if (stats?.isDirectory()) walk(path);
      else if (stats?.isFile()) visit(path, relative(root, path));
    }
  };
  walk(root);
};
export const copyRevisionSource = (sourcePath: string, targetPath: string, files?: Set<string>) => {
  mkdirSync(targetPath, { recursive: true });
  const directories = new Set([targetPath]);
  const copy = (file: string, rel: string) => {
    const target = join(targetPath, rel);
    const directory = dirname(target);
    if (!directories.has(directory)) {
      mkdirSync(directory, { recursive: true });
      directories.add(directory);
    }
    // Copy-on-write keeps accepted bytes independent without physically copying
    // large native dependencies on filesystems that support cloning.
    copyFileSync(file, target, constants.COPYFILE_FICLONE);
  };
  if (files) for (const rel of files) copy(join(sourcePath, rel), rel);
  else visitRevisionFiles(sourcePath, copy);
};
export const hashRevisionSource = (sourcePath: string, include: (path: string) => boolean = () => true) => {
  const hash = createHash("sha256");
  visitRevisionFiles(sourcePath, (file, rel) => {
    if (!include(rel)) return;
    hash.update(rel);
    hash.update("\0");
    hash.update(readFileSync(file));
  });
  return hash.digest("hex");
};
