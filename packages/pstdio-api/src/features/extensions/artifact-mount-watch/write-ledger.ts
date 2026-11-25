import { readdirSync } from "node:fs";
import { basename, dirname, join, sep } from "node:path";
import { type ArtifactMountWriteObserver, type ArtifactParentWrite, readArtifactFileState } from "pstdio-extensions";

// Long enough for a change burst to settle after a slow write. Short enough that an old entry
// cannot hide a later direct edit.
const ECHO_WINDOW_MS = 5_000;

type FileState = ReturnType<typeof readArtifactFileState>;
type PathObservation = readonly [string, FileState];
type LedgerEntry = {
  recordedAt: number;
  order: number;
  state: FileState;
  reappeared?: Set<string>;
  returnedSubtrees?: Set<string>;
};

type OwnedDirectory = {
  recordedAt: number;
  observed: NonNullable<FileState>;
  children: Map<string, NonNullable<FileState>>;
};

const sameState = (recorded: FileState, current: FileState) =>
  recorded === null || current === null
    ? recorded === current
    : recorded.identity === current.identity &&
      recorded.size === current.size &&
      recorded.mtime === current.mtime &&
      recorded.ctime === current.ctime;

const isInside = (path: string, folder: string) => path.startsWith(folder + sep);

const matchesOwnedChildren = (
  path: string,
  expected: OwnedDirectory["children"],
  observed: ReadonlyMap<string, FileState>,
) => {
  try {
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

function* pathAndAncestors(path: string) {
  for (let ancestor = path; ancestor !== dirname(ancestor); ancestor = dirname(ancestor)) yield ancestor;
}

const hasPathOrAncestor = (path: string, paths: ReadonlySet<string> | undefined) => {
  if (!paths) return false;
  for (const ancestor of pathAndAncestors(path)) {
    if (paths.has(ancestor)) return true;
  }
  return false;
};

export type ArtifactMountWriteLedger = ReturnType<typeof createArtifactMountWriteLedger>;

/**
 * Remembers writes made through the mount API, so the mount watcher reports only changes made
 * outside it. The watcher sees a mount write like any other change; the ledger tells them apart
 * by comparing what the write left on disk with what is there now.
 */
export const createArtifactMountWriteLedger = (now: () => number = Date.now) => {
  const entries = new Map<string, LedgerEntry>();
  let writeOrder = 0;
  const directories = new Map<string, OwnedDirectory>();

  const forgetExpired = () => {
    for (const [path, entry] of entries) {
      if (now() - entry.recordedAt > ECHO_WINDOW_MS) entries.delete(path);
    }
    for (const [path, entry] of directories) {
      if (now() - entry.recordedAt > ECHO_WINDOW_MS) directories.delete(path);
    }
  };

  const markReappearedPaths = (entry: LedgerEntry, observations: readonly PathObservation[]) => {
    for (const [path, state] of observations) {
      if (state) {
        entry.reappeared ??= new Set();
        entry.reappeared.add(path);
      }
    }
  };

  const rememberReappearance = (path: string, state: NonNullable<FileState>) => {
    for (const ancestor of pathAndAncestors(path)) {
      const entry = entries.get(ancestor);
      if (entry?.state === null) markReappearedPaths(entry, [[path, state]]);
    }
  };

  const isExternalReturn = (path: string, current: FileState) =>
    current !== null && directories.get(path)?.observed.identity !== current.identity;

  const retireDeletion = (retired: Map<string, number>, path: string, order: number) => {
    retired.set(path, Math.max(order, retired.get(path) ?? 0));
  };

  const isRetired = (retired: ReadonlyMap<string, number>, path: string, order: number) => {
    if (retired.size === 0) return false;
    for (const ancestor of pathAndAncestors(path)) {
      if ((retired.get(ancestor) ?? 0) >= order) return true;
    }
    return false;
  };

  const reconcileDeletion = (
    recordedPath: string,
    entry: LedgerEntry,
    current: FileState,
    related: readonly PathObservation[],
    retired: Map<string, number>,
  ) => {
    if (isExternalReturn(recordedPath, current)) {
      retireDeletion(retired, recordedPath, entry.order);
      return;
    }
    markReappearedPaths(entry, related);
    for (const [path, state] of related) {
      if (state?.directory && isInside(path, recordedPath) && isExternalReturn(path, state)) {
        entry.returnedSubtrees ??= new Set();
        entry.returnedSubtrees.add(path);
        retireDeletion(retired, path, entry.order);
      }
    }
  };

  const dropRetiredDeletions = (retired: ReadonlyMap<string, number>) => {
    // Walk the ledger once even when one notification proves many deletions are stale.
    if (retired.size === 0) return;
    for (const [path, entry] of entries) {
      if (entry.state === null && isRetired(retired, path, entry.order)) entries.delete(path);
    }
  };

  const indexDeletionHints = (observations: readonly PathObservation[]) => {
    const related = new Map<string, PathObservation[]>();
    const directories = new Set<string>();
    for (const observation of observations) {
      const [path, state] = observation;
      if (state?.directory) directories.add(path);
      for (const ancestor of pathAndAncestors(path)) {
        if (entries.get(ancestor)?.state !== null) continue;
        const hints = related.get(ancestor);
        if (hints) hints.push(observation);
        else related.set(ancestor, [observation]);
      }
    }
    return { related, directories };
  };

  const reconcileDeletions = (observations: readonly PathObservation[], byPath: ReadonlyMap<string, FileState>) => {
    const retired = new Map<string, number>();
    const hints = indexDeletionHints(observations);
    // Exact folder hints can retire old children before their individual states are read.
    for (const [path, current] of observations) {
      const entry = entries.get(path);
      if (entry?.state === null && isExternalReturn(path, current)) retireDeletion(retired, path, entry.order);
    }
    for (const [recordedPath, entry] of entries) {
      if (entry.state !== null || isRetired(retired, recordedPath, entry.order)) continue;
      const related = hints.related.get(recordedPath);
      if (!related && !hasPathOrAncestor(recordedPath, hints.directories)) continue;

      // A recursive watcher may report only a child when an external folder returns.
      const observed = byPath.get(recordedPath);
      const current = observed === undefined ? readArtifactFileState(recordedPath) : observed;
      reconcileDeletion(recordedPath, entry, current, related ?? [], retired);
    }
    dropRetiredDeletions(retired);
  };

  // An earlier tree deletion cannot explain the disappearance of a newer mount write.
  const matchesAncestorDeletion = (path: string, latestWriteOrder = 0) => {
    for (const ancestor of pathAndAncestors(dirname(path))) {
      const recorded = entries.get(ancestor);
      if (
        recorded?.state === null &&
        recorded.order >= latestWriteOrder &&
        !recorded.reappeared?.has(path) &&
        !hasPathOrAncestor(path, recorded.returnedSubtrees)
      )
        return true;
    }
    return false;
  };

  const isEcho = (
    path: string,
    current: FileState,
    observed: ReadonlyMap<string, FileState>,
    consumed: Set<string>,
    keepMatchedWrites: boolean,
  ) => {
    const entry = entries.get(path);
    const directory = directories.get(path);
    // An outside writer can add a sibling while an owned mutation is changing the same timestamps.
    const matchesDirectory =
      directory && sameState(directory.observed, current) && matchesOwnedChildren(path, directory.children, observed);
    const matchesEntry = entry && sameState(entry.state, current) && !entry.reappeared?.has(path);
    if (matchesEntry && (!directory || matchesDirectory)) {
      if (!keepMatchedWrites) {
        consumed.add(path);
        directories.delete(path);
      }
      return true;
    }
    if (entry?.state && keepMatchedWrites) consumed.add(path);
    // A changed snapshot reports the folder, while the same inode still proves an owned restore.
    if (directory && (!keepMatchedWrites || directory.observed.identity !== current?.identity)) {
      directories.delete(path);
    }
    return matchesDirectory || (!current && matchesAncestorDeletion(path, entry?.order));
  };

  const recordChild = (path: string, state: FileState) => {
    const parent = directories.get(dirname(path));
    if (!parent) return;
    const name = basename(path);
    if (state) parent.children.set(name, state);
    else parent.children.delete(name);
  };

  const advanceParentWrite = ({ path, before, after }: ArtifactParentWrite) => {
    if (!before || after?.identity !== before.identity) return;
    const directory = directories.get(path);
    if (directory && sameState(directory.observed, before)) directory.observed = after;

    const children = directories.get(dirname(path))?.children;
    const name = basename(path);
    const child = children?.get(name);
    if (child && sameState(child, before)) children?.set(name, after);
  };

  const recordCreatedDirectory = (folder: string, identity: string, recordedAt: number) => {
    const observed = readArtifactFileState(folder);
    if (!observed?.directory || observed.identity !== identity) return;
    directories.set(folder, { observed, recordedAt, children: new Map() });
    recordChild(folder, observed);
    // Creation proves reappearance even if the watcher arrives only after an outside removal.
    rememberReappearance(folder, observed);
  };

  const record: ArtifactMountWriteObserver = (path, createdDirectories, parentWrites) => {
    forgetExpired();
    const recordedAt = now();
    const state = readArtifactFileState(path);
    entries.set(path, { recordedAt, order: ++writeOrder, state });
    // Keep this fact on older ancestor deletions even after this path's own proof is consumed.
    if (state) rememberReappearance(path, state);
    if (!state) directories.delete(path);
    for (const [folder, identity] of createdDirectories ?? []) recordCreatedDirectory(folder, identity, recordedAt);
    recordChild(path, state);
    for (const write of parentWrites ?? []) advanceParentWrite(write);
  };

  return {
    /** Record the state a mount write, update, or delete left at `path`. */
    record,
    /** Return external changes. Keep matched writes when independent watchers can still echo them. */
    dropEchoes: (paths: string[], { keepMatchedWrites = false } = {}) => {
      forgetExpired();
      const observations: PathObservation[] = paths.map((path) => [path, readArtifactFileState(path)]);
      const byPath = new Map(observations);
      reconcileDeletions(observations, byPath);
      const consumed = new Set<string>();
      const kept = observations
        .filter(([path, current]) => !isEcho(path, current, byPath, consumed, keepMatchedWrites))
        .map(([path]) => path);
      // A write can explain a folder notification elsewhere in the same batch.
      for (const path of consumed) entries.delete(path);
      return kept;
    },
  };
};
