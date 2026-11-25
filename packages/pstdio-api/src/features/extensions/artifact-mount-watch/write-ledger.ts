import { dirname, sep } from "node:path";
import { type ArtifactMountWriteObserver, readArtifactFileState } from "pstdio-extensions";

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

const sameState = (recorded: FileState, current: FileState) =>
  recorded === null || current === null
    ? recorded === current
    : recorded.identity === current.identity &&
      recorded.size === current.size &&
      recorded.mtime === current.mtime &&
      recorded.ctime === current.ctime;

const isInside = (path: string, folder: string) => path.startsWith(folder + sep);

function* pathAndAncestors(path: string) {
  for (let ancestor = path; ancestor !== dirname(ancestor); ancestor = dirname(ancestor)) yield ancestor;
}

const observesDeletion = ([path, state]: PathObservation, deletedPath: string) =>
  path === deletedPath || isInside(path, deletedPath) || (state?.directory === true && isInside(deletedPath, path));

export type ArtifactMountWriteLedger = ReturnType<typeof createArtifactMountWriteLedger>;

/**
 * Remembers writes made through the mount API, so the mount watcher reports only changes made
 * outside it. The watcher sees a mount write like any other change; the ledger tells them apart
 * by comparing what the write left on disk with what is there now.
 */
export const createArtifactMountWriteLedger = (now: () => number = Date.now) => {
  const entries = new Map<string, LedgerEntry>();
  let writeOrder = 0;
  const directories = new Map<string, { recordedAt: number; observed: NonNullable<FileState> }>();

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

  const reconcileDeletions = (observations: readonly PathObservation[]) => {
    const byPath = new Map(observations);
    const retired = new Map<string, number>();
    // Exact folder hints can retire old children before their individual states are read.
    for (const [path, current] of observations) {
      const entry = entries.get(path);
      if (entry?.state === null && isExternalReturn(path, current)) retireDeletion(retired, path, entry.order);
    }
    for (const [recordedPath, entry] of entries) {
      if (entry.state !== null || isRetired(retired, recordedPath, entry.order)) continue;
      const related = observations.filter((observation) => observesDeletion(observation, recordedPath));
      if (related.length === 0) continue;

      // A recursive watcher may report only a child when an external folder returns.
      const observed = byPath.get(recordedPath);
      const current = observed === undefined ? readArtifactFileState(recordedPath) : observed;
      reconcileDeletion(recordedPath, entry, current, related, retired);
    }
    dropRetiredDeletions(retired);
  };

  const hasReturnedAncestor = (path: string, returnedSubtrees: ReadonlySet<string> | undefined) => {
    if (!returnedSubtrees) return false;
    for (const ancestor of pathAndAncestors(path)) {
      if (returnedSubtrees.has(ancestor)) return true;
    }
    return false;
  };

  // An earlier tree deletion cannot explain the disappearance of a newer mount write.
  const matchesAncestorDeletion = (path: string, latestWriteOrder = 0) => {
    for (const [recordedPath, recorded] of entries) {
      if (
        !recorded.state &&
        recorded.order >= latestWriteOrder &&
        isInside(path, recordedPath) &&
        !recorded.reappeared?.has(path) &&
        !hasReturnedAncestor(path, recorded.returnedSubtrees)
      )
        return true;
    }
    return false;
  };

  const matchesCreatedDirectory = (path: string, current: FileState, keepMatchedWrites: boolean) => {
    const recorded = directories.get(path);
    if (!recorded) return false;
    const matches = sameState(recorded.observed, current);
    // A changed snapshot reports the folder, while the same inode still proves an owned restore.
    if (!keepMatchedWrites || recorded.observed.identity !== current?.identity) directories.delete(path);
    return matches;
  };

  const isEcho = (path: string, current: FileState, consumed: Set<string>, keepMatchedWrites: boolean) => {
    const entry = entries.get(path);
    if (entry && sameState(entry.state, current) && !entry.reappeared?.has(path)) {
      if (!keepMatchedWrites) {
        consumed.add(path);
        directories.delete(path);
      }
      return true;
    }
    if (entry?.state && keepMatchedWrites) consumed.add(path);
    return (
      matchesCreatedDirectory(path, current, keepMatchedWrites) ||
      (!current && matchesAncestorDeletion(path, entry?.order))
    );
  };

  const recordCreatedDirectory = (folder: string, identity: string, recordedAt: number) => {
    const observed = readArtifactFileState(folder);
    if (!observed?.directory || observed.identity !== identity) return;
    directories.set(folder, { observed, recordedAt });
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
    for (const { path: parentPath, before, after } of parentWrites ?? []) {
      const directory = directories.get(parentPath);
      if (directory && before && after?.identity === before.identity && sameState(directory.observed, before)) {
        directory.observed = after;
      }
    }
  };

  return {
    /** Record the state a mount write, update, or delete left at `path`. */
    record,
    /** Return external changes. Keep matched writes when independent watchers can still echo them. */
    dropEchoes: (paths: string[], { keepMatchedWrites = false } = {}) => {
      forgetExpired();
      const observations: PathObservation[] = paths.map((path) => [path, readArtifactFileState(path)]);
      if (keepMatchedWrites) reconcileDeletions(observations);
      const consumed = new Set<string>();
      const kept = observations
        .filter(([path, current]) => !isEcho(path, current, consumed, keepMatchedWrites))
        .map(([path]) => path);
      // A write can explain a folder notification elsewhere in the same batch.
      for (const path of consumed) entries.delete(path);
      return kept;
    },
  };
};
