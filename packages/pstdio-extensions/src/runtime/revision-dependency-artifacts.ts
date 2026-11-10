import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, realpathSync, symlinkSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import type { collectRevisionDependencies } from "./revision-dependencies";
import { copyRevisionSource, visitRevisionFiles } from "./revision-file-inputs";
import { revisionSnapshotLocation, revisionSnapshotPath } from "./revision-snapshot-path";

export const hashRevisionDependencies = (
  packages: ReturnType<typeof collectRevisionDependencies>,
  sourcePath: string,
) => {
  const hash = createHash("sha256");
  const sourceRoot = realpathSync(sourcePath);
  const identities = new Map([...packages.keys()].map((path, index) => [path, String(index)]));
  for (const [path, input] of packages.compilerInputs) {
    hash.update(relative(sourceRoot, path));
    hash.update("\0");
    hash.update(input.contents);
    hash.update("\0");
  }
  for (const [path, entry] of packages) {
    hash.update(identities.get(path)!);
    for (const [name, resolved] of entry.dependencies)
      hash.update(`${name}\0${identities.get(resolved) ?? "missing"}\0`);
    for (const [name, resolved] of entry.moduleInputs) hash.update(`${name}\0${identities.get(resolved)}\0`);
    if (path === sourceRoot) continue;
    const addFile = (file: string, rel: string) => {
      hash.update(rel);
      hash.update("\0");
      hash.update(packages.contents.get(file) ?? readFileSync(file));
    };
    if (entry.allFiles) visitRevisionFiles(path, addFile);
    else for (const rel of [...entry.files].sort()) addFile(join(path, rel), rel);
  }
  return hash.digest("hex");
};
export const copyRevisionDependencies = (
  packages: ReturnType<typeof collectRevisionDependencies>,
  sourcePath: string,
  targetPath: string,
  generationRoot: string,
) => {
  const targets = new Map<string, string>([[realpathSync(sourcePath), targetPath]]);
  for (const [path, entry] of packages) {
    if (targets.has(path)) continue;
    const target = revisionSnapshotPath(generationRoot, path);
    targets.set(path, target);
    copyRevisionSource(path, target, entry.allFiles ? undefined : entry.files);
  }
  const links = new Map<string, string>();
  for (const entry of packages.values())
    for (const [location, dependency] of entry.bindings) {
      const target = targets.get(dependency);
      if (!target) continue;
      const link = revisionSnapshotLocation(generationRoot, location);
      linkRevisionDependency(links, link, target);
    }
};

const linkRevisionDependency = (links: Map<string, string>, link: string, target: string) => {
  const key = process.platform === "win32" ? link.toLowerCase() : link;
  const previous = links.get(key);
  if (previous && previous !== target)
    throw new Error("Extension dependency binding changed while preparing its snapshot.");
  if (previous) return;
  links.set(key, target);
  if (link === target) return;
  mkdirSync(dirname(link), { recursive: true });
  try {
    symlinkSync(target, link, "junction");
  } catch (error) {
    // An ancestor binding can make two lexical locations name the same physical link.
    if ((error as NodeJS.ErrnoException).code === "EEXIST" && realpathSync(link) === realpathSync(target)) return;
    throw error;
  }
};
