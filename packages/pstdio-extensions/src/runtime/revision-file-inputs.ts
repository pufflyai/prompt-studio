import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
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
      const stats = statSync(path, { throwIfNoEntry: false });
      if (stats?.isDirectory()) walk(path);
      else if (stats?.isFile()) visit(path, relative(root, path));
    }
  };
  walk(root);
};
export const copyRevisionSource = (sourcePath: string, targetPath: string, files?: Set<string>) => {
  mkdirSync(targetPath, { recursive: true });
  const copy = (file: string, rel: string) => {
    const target = join(targetPath, rel);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(file, target);
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
