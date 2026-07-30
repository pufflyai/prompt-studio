import { watch as fsWatch, lstatSync, readdirSync } from "node:fs";
import { basename, isAbsolute, join, relative } from "node:path";
import { createExtensionIgnoreMatcher, type ExtensionIgnoreMatcher } from "./extension-ignore";

type InstalledSourceRegistration = {
  install_name: string;
  source_path: string;
};

type SourceWatcher = {
  close: () => void;
};

const defaultDebounceMs = 100;

// Watch registration walks the source tree itself, so it must never descend into
// dependency or VCS trees: node_modules symlinks back into the monorepo store,
// and recursively registering that (Linux has no native recursive fs.watch)
// crawls hundreds of thousands of entries — enough to hang a CI job.
const skippedDirectoryNames = new Set(["node_modules", ".git"]);

type WatchListener = (eventType: string, filename: string | Buffer | null) => void;
type WatchErrorHandler = (error: unknown) => void;
type WatchSource = (path: string, listener: WatchListener, onError: WatchErrorHandler) => SourceWatcher;

type WatchedRegistration = {
  identity: string;
  matcher: ExtensionIgnoreMatcher;
  sourcePath: string;
  timer: ReturnType<typeof setTimeout> | null;
  watchers: Map<string, SourceWatcher>;
};

export type ExtensionSourceWatcher = {
  dispose: () => void;
  refresh: () => Promise<void>;
};

export type CreateExtensionSourceWatcherInput = {
  debounceMs?: number;
  listInstalledSources: () => Promise<InstalledSourceRegistration[]>;
  onError?: (error: unknown) => void;
  reloadInstalledSource: (sourcePath: string) => Promise<unknown>;
  watch?: WatchSource;
};

// Watches a single directory (non-recursive). fs errors — e.g. the directory
// disappearing mid-watch — are routed to onError so they can't crash the API
// process via an unhandled 'error' event.
const defaultWatch: WatchSource = (path, listener, onError) => {
  const watcher = fsWatch(path, listener);
  watcher.on("error", onError);
  return watcher;
};

const sourceIdentity = (sourcePath: string) => {
  const stats = lstatSync(sourcePath, { bigint: true });
  return [
    stats.dev.toString(),
    stats.ino.toString(),
    stats.birthtimeNs.toString(),
    stats.ctimeNs.toString(),
    stats.mtimeMs.toString(),
  ].join(":");
};

const listWatchableDirectories = (sourcePath: string, matcher: ExtensionIgnoreMatcher, startPath: string) => {
  const directories: string[] = [];

  const visit = (dir: string) => {
    directories.push(dir);
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      // Dirent.isDirectory() does not follow symlinks, so linked directories
      // (which can point anywhere, including outside the extension) are skipped.
      if (!entry.isDirectory()) continue;
      if (skippedDirectoryNames.has(entry.name)) continue;
      const path = join(dir, entry.name);
      if (matcher.ignores(relative(sourcePath, path))) continue;
      visit(path);
    }
  };

  visit(startPath);
  return directories;
};

const toEventPath = (directoryPath: string, filename: string | Buffer | null) => {
  if (!filename) return directoryPath;
  const value = filename.toString();
  return isAbsolute(value) ? value : join(directoryPath, value);
};

export const createExtensionSourceWatcher = async (
  input: CreateExtensionSourceWatcherInput,
): Promise<ExtensionSourceWatcher> => {
  const debounceMs = input.debounceMs ?? defaultDebounceMs;
  const registrations = new Map<string, WatchedRegistration>();
  const watch = input.watch ?? defaultWatch;
  let disposed = false;

  const disposeRegistration = (registration: WatchedRegistration) => {
    if (registration.timer) clearTimeout(registration.timer);
    for (const watcher of registration.watchers.values()) watcher.close();
    registration.watchers.clear();
  };

  const scheduleReload = (registration: WatchedRegistration) => {
    if (registration.timer) clearTimeout(registration.timer);

    registration.timer = setTimeout(() => {
      registration.timer = null;
      input.reloadInstalledSource(registration.sourcePath).catch((error) => input.onError?.(error));
    }, debounceMs);
  };

  const watchDirectory = (registration: WatchedRegistration, directoryPath: string) => {
    if (registration.watchers.has(directoryPath)) return;

    try {
      const watcher = watch(
        directoryPath,
        (eventType, filename) => handleDirectoryEvent(registration, directoryPath, eventType, filename),
        (error) => input.onError?.(error),
      );
      registration.watchers.set(directoryPath, watcher);
    } catch (error) {
      input.onError?.(error);
    }
  };

  const watchDirectoryTree = (registration: WatchedRegistration, startPath: string) => {
    let directories: string[];
    try {
      directories = listWatchableDirectories(registration.sourcePath, registration.matcher, startPath);
    } catch (error) {
      input.onError?.(error);
      return;
    }

    for (const directoryPath of directories) watchDirectory(registration, directoryPath);
  };

  const watchCreatedDirectory = (registration: WatchedRegistration, eventPath: string) => {
    if (registration.watchers.has(eventPath)) return;
    if (skippedDirectoryNames.has(basename(eventPath))) return;

    const stats = lstatSync(eventPath, { throwIfNoEntry: false });
    if (!stats?.isDirectory()) return;

    watchDirectoryTree(registration, eventPath);
  };

  const handleDirectoryEvent = (
    registration: WatchedRegistration,
    directoryPath: string,
    _eventType: string,
    filename: string | Buffer | null,
  ) => {
    const eventPath = toEventPath(directoryPath, filename);
    const relativePath = relative(registration.sourcePath, eventPath);
    if (relativePath && registration.matcher.ignores(relativePath)) return;

    watchCreatedDirectory(registration, eventPath);
    scheduleReload(registration);
  };

  const addRegistration = (row: InstalledSourceRegistration) => {
    const registration: WatchedRegistration = {
      identity: sourceIdentity(row.source_path),
      matcher: createExtensionIgnoreMatcher(row.source_path),
      sourcePath: row.source_path,
      timer: null,
      watchers: new Map(),
    };

    registrations.set(row.source_path, registration);
    watchDirectoryTree(registration, row.source_path);
  };

  const refreshRegistration = async (
    sourcePath: string,
    registration: WatchedRegistration,
    rows: InstalledSourceRegistration[],
  ) => {
    const next = rows.find((row) => row.source_path === sourcePath);
    if (!next) {
      disposeRegistration(registration);
      registrations.delete(sourcePath);
      return;
    }
    if (sourceIdentity(sourcePath) === registration.identity) return;

    disposeRegistration(registration);
    registrations.delete(sourcePath);
    addRegistration(next);
    try {
      await input.reloadInstalledSource(sourcePath);
    } catch (error) {
      input.onError?.(error);
    }
  };

  const refresh = async () => {
    if (disposed) return;

    const rows = await input.listInstalledSources();

    for (const [sourcePath, registration] of registrations) {
      await refreshRegistration(sourcePath, registration, rows);
    }

    for (const row of rows) {
      if (!registrations.has(row.source_path)) addRegistration(row);
    }
  };

  const dispose = () => {
    disposed = true;
    for (const registration of registrations.values()) disposeRegistration(registration);
    registrations.clear();
  };

  await refresh();

  return { dispose, refresh };
};
