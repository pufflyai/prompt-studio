import { readdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { type ArtifactParentWrite, readArtifactFileState } from "pstdio-extensions";
import { createPathSubtrees } from "./path-subtrees";

export type FileState = ReturnType<typeof readArtifactFileState>;
type PresentState = NonNullable<FileState>;
type RecordedChild = { state: FileState; nestedDirectory?: OwnedDirectory; directoryReports?: Set<ReportedChild> };

export type OwnedDirectory = {
  recordedAt: number;
  observed: NonNullable<FileState>;
  echoConsumed?: boolean;
  children: Map<string, RecordedChild>;
};

type ReportedChild = {
  forWrite: RecordedChild;
  state: FileState;
  contents?: Map<string, PresentState>;
};
export type ReportedChildren = WeakMap<OwnedDirectory, Map<string, ReportedChild>>;

export const createOwnedDirectories = () => {
  const directories = new Map<string, OwnedDirectory>();
  const subtrees = createPathSubtrees();

  const forgetDirectory = (path: string) => {
    if (directories.delete(path)) subtrees.forget(path);
  };

  const forgetDirectoryTree = (path: string) => {
    // Index folders so a series of file removals never searches every owned directory.
    for (const folder of subtrees.under(path) ?? []) forgetDirectory(folder);
  };

  const recordDirectory = (path: string, directory: OwnedDirectory) => {
    directories.set(path, directory);
    subtrees.record(path);
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

const sampleDirectoryContents = (path: string, state: PresentState) => {
  try {
    const contents = new Map<string, PresentState>();
    for (const name of readdirSync(path)) {
      const child = readArtifactFileState(join(path, name));
      if (!child) return;
      contents.set(name, child);
    }
    if (sameState(state, readArtifactFileState(path))) return contents;
  } catch {
    // The directory may disappear during a watch callback.
  }
};

const setChildState = (contents: Map<string, PresentState> | undefined, name: string, state: FileState) => {
  if (state) contents?.set(name, state);
  else contents?.delete(name);
};

const currentChildRecord = (directories: ReadonlyMap<string, OwnedDirectory>, path: string) =>
  directories.get(dirname(path))?.children.get(basename(path));

export const recordReportedChild = (
  reported: ReportedChildren,
  directories: ReadonlyMap<string, OwnedDirectory>,
  path: string,
  state: FileState,
) => {
  const parentPath = dirname(path);
  const name = basename(path);
  const ancestor = directories.get(dirname(parentPath));
  const parentReport = ancestor && reported.get(ancestor)?.get(basename(parentPath));
  if (parentReport && parentReport.forWrite === currentChildRecord(directories, parentPath)) {
    setChildState(parentReport.contents, name, state);
  }

  const parent = directories.get(parentPath);
  if (!parent) return;
  const children = reported.get(parent) ?? new Map<string, ReportedChild>();
  const previous = children.get(name);
  previous?.forWrite.directoryReports?.delete(previous);

  const forWrite = parent.children.get(name) ?? { state: null };
  parent.children.set(name, forWrite);
  const contents = state?.directory ? sampleDirectoryContents(path, state) : undefined;
  const report = { forWrite, state, contents };
  children.set(name, report);
  if (contents) {
    forWrite.directoryReports ??= new Set();
    forWrite.directoryReports.add(report);
  }
  reported.set(parent, children);
};

const advanceRecordedDirectoryChild = (
  parent: OwnedDirectory | undefined,
  name: string,
  before: PresentState,
  after: PresentState,
  nestedDirectory: OwnedDirectory | undefined,
) => {
  const child = parent?.children.get(name);
  if (!parent || !child) return;
  if (sameState(child.state, before)) {
    parent.children.set(name, { state: after, nestedDirectory });
    return;
  }
  // Only a watcher that reported the exact pre-write state can suppress its later echo.
  for (const report of child.directoryReports ?? []) {
    if (!sameState(report.state, before)) continue;
    report.state = after;
  }
};

const expectedChildren = (directory: OwnedDirectory, reported: ReportedChildren) => {
  const expected = new Map<string, RecordedChild | ReportedChild>();
  for (const [name, child] of directory.children) {
    if (child.state) expected.set(name, child);
  }
  for (const [name, child] of reported.get(directory) ?? []) {
    // A later owned operation replaces the proof that this reported observation depended on.
    if (directory.children.get(name) !== child.forWrite) continue;
    if (child.state) expected.set(name, child);
    else expected.delete(name);
  }
  return expected;
};

const matchesReportedContents = (path: string, contents: ReadonlyMap<string, PresentState>) => {
  const names = readdirSync(path);
  return (
    names.length === contents.size &&
    names.every((name) => {
      const expected = contents.get(name);
      // A folder's timestamps do not prove that the files below it stayed unchanged.
      return (
        expected !== undefined && !expected.directory && sameState(expected, readArtifactFileState(join(path, name)))
      );
    })
  );
};

const matchesOwnedChildren = (
  path: string,
  directory: OwnedDirectory,
  observed: ReadonlyMap<string, FileState>,
  reported: ReportedChildren,
): boolean => {
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
        if (childHint !== undefined && !sameState(recorded.state, childHint)) return true;
        if (!sameState(recorded.state, readArtifactFileState(childPath))) return false;
        if ("forWrite" in recorded && recorded.state?.directory) {
          return recorded.contents !== undefined && matchesReportedContents(childPath, recorded.contents);
        }
        if ("nestedDirectory" in recorded && recorded.nestedDirectory) {
          return matchesOwnedChildren(childPath, recorded.nestedDirectory, observed, reported);
        }
        return true;
      })
    );
  } catch {
    return false;
  }
};

export const matchesDirectoryEcho = (
  path: string,
  directory: OwnedDirectory | undefined,
  current: FileState,
  observed: ReadonlyMap<string, FileState>,
  reported: ReportedChildren,
) =>
  directory !== undefined &&
  !directory.echoConsumed &&
  sameState(directory.observed, current) &&
  matchesOwnedChildren(path, directory, observed, reported);

export const recordOwnedChild = (directories: ReadonlyMap<string, OwnedDirectory>, path: string, state: FileState) => {
  const parentPath = dirname(path);
  const name = basename(path);
  for (const report of currentChildRecord(directories, parentPath)?.directoryReports ?? []) {
    setChildState(report.contents, name, state);
  }
  const parent = directories.get(parentPath);
  if (!parent) return;
  parent.children.set(name, { state });
};

export const advanceParentWrite = (
  directories: ReadonlyMap<string, OwnedDirectory>,
  { path, before, after }: ArtifactParentWrite,
) => {
  if (!before || after?.identity !== before.identity) return;
  const directory = directories.get(path);
  if (directory && sameState(directory.observed, before)) directory.observed = after;

  advanceRecordedDirectoryChild(directories.get(dirname(path)), basename(path), before, after, directory);
};
