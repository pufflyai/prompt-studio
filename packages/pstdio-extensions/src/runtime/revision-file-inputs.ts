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

type RevisionFileCopy = { source: string; target: string };

export const copyRevisionFiles = async (files: Iterable<RevisionFileCopy>) => {
  const entries = files[Symbol.iterator]();
  const directories = new Set<string>();
  const copies = new Map<string, string>();
  const copy = ({ source, target }: RevisionFileCopy) => {
    const key = process.platform === "win32" ? target.toLowerCase() : target;
    const owner = process.platform === "win32" ? source.toLowerCase() : source;
    const previous = copies.get(key);
    if (previous === owner) return;
    if (previous !== undefined) throw new Error("Snapshot file has conflicting source owners.");
    // Ancestor and nested package roots can enumerate the same frozen file.
    copies.set(key, owner);
    const directory = dirname(target);
    if (!directories.has(directory)) {
      mkdirSync(directory, { recursive: true });
      directories.add(directory);
    }
    // Retain independent accepted bytes, using copy-on-write where available.
    return copyFile(source, target, constants.COPYFILE_FICLONE);
  };
  let failure: { reason: unknown } | undefined;
  await Promise.all(
    Array.from({ length: 8 }, async () => {
      try {
        while (!failure) {
          const entry = entries.next();
          if (entry.done) return;
          await copy(entry.value);
        }
      } catch (reason) {
        failure ??= { reason };
      }
    }),
  );
  // Every admitted write must finish before a failed preparation can remove its snapshot.
  if (failure) throw failure.reason;
};

export const copyRevisionSource = (sourcePath: string, targetPath: string, files?: Set<string>) =>
  copyRevisionFiles(revisionSourceFiles(sourcePath, targetPath, files));
export const hashRevisionSource = (
  sourcePath: string,
  include: (path: string) => boolean = () => true,
  readSource: (path: string) => Buffer = readFileSync,
) => {
  const hash = createHash("sha256");
  visitRevisionFiles(sourcePath, (file, rel) => {
    if (!include(rel)) return;
    hash.update(rel);
    hash.update("\0");
    hash.update(readSource(file));
  });
  return hash.digest("hex");
};
