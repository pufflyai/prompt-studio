import { sep } from "node:path";
import { type ArtifactMountWriteObserver, readArtifactFileState } from "pstdio-extensions";

// Long enough for a change burst to settle after a slow write. Short enough that an old entry
// cannot hide a later direct edit.
const ECHO_WINDOW_MS = 5_000;

type FileState = ReturnType<typeof readArtifactFileState>;
type PathObservation = readonly [string, FileState];
type LedgerEntry = {
  recordedAt: number;
  state: FileState;
  reappeared?: Set<string>;
};

const sameState = (recorded: FileState, current: FileState) =>
  recorded === null || current === null
    ? recorded === current
    : recorded.identity === current.identity &&
      recorded.size === current.size &&
      recorded.mtime === current.mtime &&
      recorded.ctime === current.ctime;

const isInside = (path: string, folder: string) => path.startsWith(folder + sep);

export type ArtifactMountWriteLedger = ReturnType<typeof createArtifactMountWriteLedger>;

/**
 * Remembers writes made through the mount API, so the mount watcher reports only changes made
 * outside it. The watcher sees a mount write like any other change; the ledger tells them apart
 * by comparing what the write left on disk with what is there now.
 */
export const createArtifactMountWriteLedger = (now: () => number = Date.now) => {
  const entries = new Map<string, LedgerEntry>();
  const directories = new Map<string, { recordedAt: number; observed: FileState }>();

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

  const reconcileDeletions = (observations: readonly PathObservation[]) => {
    const byPath = new Map(observations);
    for (const [recordedPath, entry] of entries) {
      if (entry.state !== null) continue;
      const related = observations.filter(([path]) => path === recordedPath || isInside(path, recordedPath));
      if (related.length === 0) continue;

      // A recursive watcher may report only a child when an external folder returns.
      const observed = byPath.get(recordedPath);
      const current = observed === undefined ? readArtifactFileState(recordedPath) : observed;
      const owned = directories.get(recordedPath)?.observed ?? null;
      const returnedByMount =
        observed === undefined ? owned?.identity === current?.identity : sameState(owned, current);
      if (current && !returnedByMount) {
        entries.delete(recordedPath);
        continue;
      }
      markReappearedPaths(entry, related);
    }
  };

  const matchesAncestorDeletion = (path: string) => {
    for (const [recordedPath, recorded] of entries) {
      if (!recorded.state && isInside(path, recordedPath) && !recorded.reappeared?.has(path)) return true;
    }
    return false;
  };

  const matchesCreatedDirectory = (path: string, current: FileState, keepMatchedWrites: boolean) => {
    const recorded = directories.get(path);
    if (!recorded) return false;
    const matches = sameState(recorded.observed, current);
    if (!matches || !keepMatchedWrites) directories.delete(path);
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
    return matchesCreatedDirectory(path, current, keepMatchedWrites) || (!current && matchesAncestorDeletion(path));
  };

  const record: ArtifactMountWriteObserver = (path, createdDirectories, parentWrites) => {
    forgetExpired();
    const recordedAt = now();
    const state = readArtifactFileState(path);
    entries.set(path, { recordedAt, state });
    if (!state) directories.delete(path);
    for (const [folder, identity] of createdDirectories ?? []) {
      const observed = readArtifactFileState(folder);
      if (observed?.directory && observed.identity === identity) directories.set(folder, { observed, recordedAt });
    }
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
