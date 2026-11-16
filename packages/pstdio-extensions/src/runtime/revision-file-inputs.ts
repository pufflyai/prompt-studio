import { createHash } from "node:crypto";
import { constants, mkdirSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { copyFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";

export const visitRevisionFiles = (root: string, visit: (path: string, rel: string) => void) => {
  const directories = new Set<string>();
  const walk = (directory: string) => {
    const canonical = realpathSync(directory);
    if (directories.has(canonical)) return;
    directories.add(canonical);
    try {
      for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) =>
        a.name.localeCompare(b.name),
      )) {
        if (entry.name === "node_modules" || entry.name === ".git" || entry.name.startsWith(".pstdio-runtime-"))
          continue;
        const path = join(directory, entry.name);
        const stats = entry.isSymbolicLink() ? statSync(path, { throwIfNoEntry: false }) : entry;
        if (stats?.isDirectory()) walk(path);
        else if (stats?.isFile()) visit(path, relative(root, path));
      }
    } finally {
      directories.delete(canonical);
    }
  };
  walk(root);
};
export function* revisionSourceFiles(sourcePath: string, targetPath: string, files?: Set<string>) {
  mkdirSync(targetPath, { recursive: true });
  if (files) {
    for (const rel of files) yield { source: join(sourcePath, rel), target: join(targetPath, rel) };
  } else {
    const entries: { source: string; target: string }[] = [];
    visitRevisionFiles(sourcePath, (source, rel) => entries.push({ source, target: join(targetPath, rel) }));
    yield* entries;
  }
}

export const copyRevisionFiles = async (files: Iterable<{ source: string; target: string }>) => {
  const entries = files[Symbol.iterator]();
  const directories = new Set<string>();
  const copies = new Map<string, string>();
  const results = await Promise.allSettled(
    Array.from({ length: 8 }, async () => {
      while (true) {
        const entry = entries.next();
        if (entry.done) return;
        const { source, target } = entry.value;
        const key = process.platform === "win32" ? target.toLowerCase() : target;
        const owner = process.platform === "win32" ? source.toLowerCase() : source;
        const previous = copies.get(key);
        if (previous === owner) continue;
        if (previous !== undefined) throw new Error("Snapshot file has conflicting source owners.");
        // Ancestor and nested package roots can enumerate the same frozen file.
        copies.set(key, owner);
        const directory = dirname(target);
        if (!directories.has(directory)) {
          mkdirSync(directory, { recursive: true });
          directories.add(directory);
        }
        // Retain independent accepted bytes, using copy-on-write where available.
        await copyFile(source, target, constants.COPYFILE_FICLONE);
      }
    }),
  );
  // Every admitted write must finish before a failed preparation can remove its snapshot.
  const failed = results.find((result) => result.status === "rejected");
  if (failed?.status === "rejected") throw failed.reason;
};

export const copyRevisionSource = (sourcePath: string, targetPath: string, files?: Set<string>) =>
  copyRevisionFiles(revisionSourceFiles(sourcePath, targetPath, files));
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
