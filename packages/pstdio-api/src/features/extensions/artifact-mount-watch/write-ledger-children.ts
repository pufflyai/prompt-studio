import { readdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { type ArtifactParentWrite, readArtifactFileState } from "pstdio-extensions";

export type FileState = ReturnType<typeof readArtifactFileState>;
type RecordedChild = { state: FileState };
export type OwnedDirectory = {
  recordedAt: number;
  observed: NonNullable<FileState>;
  children: Map<string, RecordedChild>;
  parentWrites: Map<string, ArtifactParentWrite[]>;
};
type ReportedChild = { forWrite: RecordedChild | undefined; state: FileState; parentWriteCount: number };
export type ReportedChildren = WeakMap<OwnedDirectory, Map<string, ReportedChild>>;

export function* pathAndAncestors(path: string) {
  for (let ancestor = path; ancestor !== dirname(ancestor); ancestor = dirname(ancestor)) yield ancestor;
}

export const createOwnedDirectories = () => {
  const directories = new Map<string, OwnedDirectory>();
  const directorySubtrees = new Map<string, Set<string>>();

  const forgetDirectory = (path: string) => {
    if (!directories.delete(path)) return;
    for (const ancestor of pathAndAncestors(path)) {
      const subtree = directorySubtrees.get(ancestor);
      subtree?.delete(path);
      if (subtree?.size === 0) directorySubtrees.delete(ancestor);
    }
  };

  const forgetDirectoryTree = (path: string) => {
    // A file deletion has no owned descendants. Index folders so a bulk delete
    // does not scan all directory proofs once per file.
    for (const folder of directorySubtrees.get(path) ?? []) forgetDirectory(folder);
  };

  const recordDirectory = (path: string, directory: OwnedDirectory) => {
    directories.set(path, directory);
    for (const ancestor of pathAndAncestors(path)) {
      const subtree = directorySubtrees.get(ancestor) ?? new Set();
      subtree.add(path);
      directorySubtrees.set(ancestor, subtree);
    }
  };
  return { directories, recordDirectory, forgetDirectory, forgetDirectoryTree };
};

export const sameState = (recorded: FileState, current: FileState) =>
  recorded === null || current === null
    ? recorded === current
    : recorded.identity === current.identity &&
      recorded.size === current.size &&
      recorded.mtime === current.mtime &&
      recorded.ctime === current.ctime;

export const recordReportedChild = (
  reported: ReportedChildren,
  directories: ReadonlyMap<string, OwnedDirectory>,
  path: string,
  state: FileState,
) => {
  const parent = directories.get(dirname(path));
  if (!parent) return;
  const name = basename(path);
  const children = reported.get(parent) ?? new Map();
  children.set(name, {
    forWrite: parent.children.get(name),
    state,
    parentWriteCount: parent.parentWrites.get(name)?.length ?? 0,
  });
  reported.set(parent, children);
};

const expectedChildren = (directory: OwnedDirectory, reported: ReportedChildren) => {
  const expected = new Map<string, NonNullable<FileState>>();
  for (const [name, child] of directory.children) {
    if (child.state) expected.set(name, child.state);
  }
  for (const [name, child] of reported.get(directory) ?? []) {
    // A later owned operation replaces the proof that this reported observation depended on.
    if (directory.children.get(name) !== child.forWrite) continue;
    const writes = directory.parentWrites.get(name) ?? [];
    for (let index = child.parentWriteCount; index < writes.length; index++) {
      const write = writes[index]!;
      if (sameState(child.state, write.before)) child.state = write.after;
    }
    child.parentWriteCount = writes.length;
    if (child.state) expected.set(name, child.state);
    else expected.delete(name);
  }
  return expected;
};

export const matchesOwnedChildren = (
  path: string,
  directory: OwnedDirectory,
  observed: ReadonlyMap<string, FileState>,
  reported: ReportedChildren,
) => {
  try {
    const expected = expectedChildren(directory, reported);
    const names = readdirSync(path);
    return (
      names.length === expected.size &&
      names.every((name) => {
        const recorded = expected.get(name);
        if (!recorded) return false;
        const childPath = join(path, name);
        const childHint = observed.get(childPath);
        // The changed child already accounts for an independent hint in this batch.
        if (childHint !== undefined && !sameState(recorded, childHint)) return true;
        return sameState(recorded, readArtifactFileState(childPath));
      })
    );
  } catch {
    return false;
  }
};

export const advanceParentWrite = (directories: ReadonlyMap<string, OwnedDirectory>, write: ArtifactParentWrite) => {
  const { path, before, after } = write;
  if (!before || after?.identity !== before.identity) return;
  const directory = directories.get(path);
  if (directory && sameState(directory.observed, before)) directory.observed = after;

  const parent = directories.get(dirname(path));
  if (!parent) return;
  const name = basename(path);
  const child = parent.children.get(name);
  if (child && sameState(child.state, before)) {
    parent.children.set(name, { state: after });
    parent.parentWrites.delete(name);
  } else if (!sameState(before, after)) {
    // Keep transitions with the expiring directory proof. Each watcher applies only
    // those that continue the exact external state it already delivered.
    const writes = parent.parentWrites.get(name) ?? [];
    writes.push(write);
    parent.parentWrites.set(name, writes);
  }
};
