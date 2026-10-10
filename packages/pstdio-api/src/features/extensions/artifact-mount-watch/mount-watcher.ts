import { lstatSync, mkdirSync } from "node:fs";
import { isAbsolute, relative, sep } from "node:path";
import { createDirectoryTreeWatcher, type WatchDirectory } from "pstdio-extensions";
import type { ArtifactMountWriteLedger } from "./write-ledger";

// A burst ends this long after its last change, so one save that touches several files
// refreshes a view once.
const QUIET_MS = 200;
// While changes keep coming, a mount reports at most once per interval, and a burst never waits
// longer than one interval.
const INTERVAL_MS = 1_000;
// Past this many paths a listener should reload the whole mount anyway.
const MAX_PATHS = 200;
// Each folder costs one OS watch on Linux, and the per-user limit is shared with every process.
const MAX_FOLDERS = 2_000;

export type ArtifactMountWatcherInput = {
  /** Absolute mount folder. It is created when missing. */
  root: string;
  ledger: Pick<ArtifactMountWriteLedger, "dropEchoes">;
  /** Changed paths relative to the root, or `[]` when the listener should reload everything. */
  onChange: (paths: string[]) => void;
  onError: (error: unknown) => void;
  onFolderLimit: () => void;
  maxFolders?: number;
  watch?: WatchDirectory;
};

const isFolder = (path: string) => {
  try {
    return lstatSync(path, { throwIfNoEntry: false })?.isDirectory() === true;
  } catch {
    return false;
  }
};

const isInsideRoot = (mountPath: string) =>
  mountPath !== "" && mountPath !== ".." && !mountPath.startsWith(`..${sep}`) && !isAbsolute(mountPath);

/** Watch one mount folder and report changes made outside the mount API in debounced bursts. */
export const watchArtifactMount = (input: ArtifactMountWatcherInput) => {
  const pending = new Set<string>();
  // The mount folder itself was removed or replaced, so the paths of this burst do not say what is left.
  let rootChanged = false;
  let burstStartedAt: number | null = null;
  let lastReportAt = Number.NEGATIVE_INFINITY;
  let timer: ReturnType<typeof setTimeout> | null = null;
  // Folders past the limit are not watched, so their changes go unseen.
  let incomplete = false;

  const report = () => {
    const changed = input.ledger.dropEchoes([...pending]);
    const reloadAll = rootChanged || incomplete || changed.length > MAX_PATHS;
    pending.clear();
    rootChanged = false;
    if (changed.length === 0 && !reloadAll) return;

    lastReportAt = Date.now();
    input.onChange(reloadAll ? [] : changed.map((path) => relative(input.root, path).split(sep).join("/")).sort());
  };

  const flush = () => {
    timer = null;
    burstStartedAt = null;
    try {
      report();
    } catch (error) {
      input.onError(error);
    }
  };

  const scheduleFlush = () => {
    const now = Date.now();
    burstStartedAt ??= now;
    const settledAt = Math.min(now + QUIET_MS, burstStartedAt + INTERVAL_MS);
    const dueAt = Math.max(settledAt, lastReportAt + INTERVAL_MS);
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, dueAt - now);
  };

  const handleEvent = (eventType: string, path: string) => {
    // Windows also reports a folder as changed when an entry inside it changes. The entry has its
    // own event, so only a folder that was created, removed, or renamed counts.
    if (eventType === "change" && isFolder(path)) return;
    const mountPath = relative(input.root, path);
    if (mountPath === "") rootChanged = true;
    else if (isInsideRoot(mountPath)) pending.add(path);
    else return;
    scheduleFlush();
  };

  mkdirSync(input.root, { recursive: true });
  const tree = createDirectoryTreeWatcher({
    root: input.root,
    onEvent: handleEvent,
    onError: input.onError,
    maxDirectories: input.maxFolders ?? MAX_FOLDERS,
    onDirectoryLimit: () => {
      incomplete = true;
      input.onFolderLimit();
    },
    watch: input.watch,
  });

  return {
    close: () => {
      if (timer) clearTimeout(timer);
      pending.clear();
      tree.close();
    },
  };
};
