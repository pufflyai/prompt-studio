import { sep } from "node:path";
import { type ArtifactMountWriteObserver, readArtifactFileState } from "pstdio-extensions";

// Long enough for a change burst to settle after a slow write. Short enough that an old entry
// cannot hide a later direct edit.
const ECHO_WINDOW_MS = 5_000;

type FileState = ReturnType<typeof readArtifactFileState>;
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

  const rememberReappearance = (path: string) => {
    for (const [recordedPath, entry] of entries) {
      if (entry.state === null && (path === recordedPath || isInside(path, recordedPath))) {
        entry.reappeared ??= new Set();
        entry.reappeared.add(path);
      }
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

  const isEcho = (path: string, consumed: Set<string>, keepMatchedWrites: boolean) => {
    const current = readArtifactFileState(path);
    if (keepMatchedWrites && current) rememberReappearance(path);
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

  const record: ArtifactMountWriteObserver = (path, createdDirectories, parentWrite) => {
    forgetExpired();
    const recordedAt = now();
    entries.set(path, { recordedAt, state: readArtifactFileState(path) });
    for (const [folder, identity] of createdDirectories ?? []) {
      const observed = readArtifactFileState(folder);
      if (observed?.directory && observed.identity === identity) directories.set(folder, { observed, recordedAt });
    }
    if (parentWrite?.before && parentWrite.after?.identity === parentWrite.before.identity) {
      const directory = directories.get(parentWrite.path);
      if (directory && sameState(directory.observed, parentWrite.before)) directory.observed = parentWrite.after;
    }
  };

  return {
    /** Record the state a mount write, update, or delete left at `path`. */
    record,
    /** Return external changes. Keep matched writes when independent watchers can still echo them. */
    dropEchoes: (paths: string[], { keepMatchedWrites = false } = {}) => {
      forgetExpired();
      const consumed = new Set<string>();
      const kept = paths.filter((path) => !isEcho(path, consumed, keepMatchedWrites));
      // A write can explain a folder notification elsewhere in the same batch.
      for (const path of consumed) entries.delete(path);
      return kept;
    },
  };
};
