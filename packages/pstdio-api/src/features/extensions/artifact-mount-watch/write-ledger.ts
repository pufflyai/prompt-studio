import { lstatSync } from "node:fs";
import { sep } from "node:path";

// Long enough for a change burst to settle after a slow write. Short enough that an old entry
// cannot hide a later direct edit.
const ECHO_WINDOW_MS = 5_000;

type FileState = { size: number; mtimeMs: number } | null;

type LedgerEntry = { recordedAt: number; state: FileState };

const readState = (path: string) => {
  // lstat throws ENOTDIR when a parent folder was replaced by a file. Either way the path is gone.
  try {
    const stats = lstatSync(path, { throwIfNoEntry: false });
    return stats ? { size: stats.size, mtimeMs: stats.mtimeMs, directory: stats.isDirectory() } : null;
  } catch {
    return null;
  }
};

const sameState = (recorded: FileState, current: FileState) =>
  recorded === null || current === null
    ? recorded === current
    : recorded.size === current.size && recorded.mtimeMs === current.mtimeMs;

const isInside = (path: string, folder: string) => path.startsWith(folder + sep);

export type ArtifactMountWriteLedger = ReturnType<typeof createArtifactMountWriteLedger>;

/**
 * Remembers writes made through the mount API, so the mount watcher reports only changes made
 * outside it. The watcher sees a mount write like any other change; the ledger tells them apart
 * by comparing what the write left on disk with what is there now.
 */
export const createArtifactMountWriteLedger = (now: () => number = Date.now) => {
  const entries = new Map<string, LedgerEntry>();

  const forgetExpired = () => {
    for (const [path, entry] of entries) {
      if (now() - entry.recordedAt > ECHO_WINDOW_MS) entries.delete(path);
    }
  };

  const isEcho = (path: string, matched: Set<string>) => {
    const current = readState(path);
    const entry = entries.get(path);
    if (entry && sameState(entry.state, current)) {
      matched.add(path);
      return true;
    }
    for (const [recordedPath, recorded] of entries) {
      // A folder the mount created on the way to a file it wrote.
      if (recorded.state && current?.directory && isInside(recordedPath, path)) return true;
      // An entry that disappeared with a folder the mount deleted.
      if (!recorded.state && !current && isInside(path, recordedPath)) return true;
    }
    return false;
  };

  return {
    /** Record the state a mount write, update, or delete left at `path`. */
    record: (path: string) => {
      forgetExpired();
      const state = readState(path);
      entries.set(path, { recordedAt: now(), state: state && { size: state.size, mtimeMs: state.mtimeMs } });
    },
    /** Return the paths that changed outside the mount API. A matched write is forgotten. */
    dropEchoes: (paths: string[]) => {
      forgetExpired();
      const matched = new Set<string>();
      const kept = paths.filter((path) => !isEcho(path, matched));
      for (const path of matched) entries.delete(path);
      return kept;
    },
  };
};
