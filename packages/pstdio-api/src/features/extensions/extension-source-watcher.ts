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
  queued: boolean;
  running: boolean;
  sourcePath: string;
  timer: ReturnType<typeof setTimeout> | null;
  watchers: Map<string, SourceWatcher>;
};

export type ExtensionSourceWatcher = {
  dispose: () => void;
  refresh: (sourcePath?: string) => Promise<void>;
};

export type CreateExtensionSourceWatcherInput = {
  debounceMs?: number;
  includeIgnoredPath?: (path: string) => boolean;
  listInstalledSources: () => Promise<InstalledSourceRegistration[]>;
  onError?: (error: unknown) => void;
  /** Called when a watched source folder changes. It must not adopt the new source. */
  onSourceChanged: (sourcePath: string) => Promise<unknown>;
  watch?: WatchSource;
  watchDependencies?: boolean;
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
  return [stats.dev.toString(), stats.ino.toString(), stats.birthtimeNs.toString()].join(":");
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
  const watchDependencies = input.watchDependencies ?? true;
  let disposed = false;

  const disposeRegistration = (registration: WatchedRegistration) => {
    registration.queued = false;
    if (registration.timer) clearTimeout(registration.timer);
    for (const watcher of registration.watchers.values()) watcher.close();
    registration.watchers.clear();
  };

  const runReload = (registration: WatchedRegistration) => {
    if (disposed || registrations.get(registration.sourcePath) !== registration) return;
    if (registration.running) {
      registration.queued = true;
      return;
    }

    registration.running = true;
    input
      .onSourceChanged(registration.sourcePath)
      .catch((error) => input.onError?.(error))
      .finally(() => {
        registration.running = false;
        if (disposed || registrations.get(registration.sourcePath) !== registration) return;
        if (!registration.queued) return;

        registration.queued = false;
        scheduleReload(registration);
      });
  };

  const scheduleReload = (registration: WatchedRegistration) => {
    if (registration.timer) clearTimeout(registration.timer);

    registration.timer = setTimeout(() => {
      registration.timer = null;
      runReload(registration);
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

  const watchDependencyRoot = (registration: WatchedRegistration) => {
    const dependencyRoot = join(registration.sourcePath, "node_modules");
    const existingWatcher = registration.watchers.get(dependencyRoot);
    const stats = lstatSync(dependencyRoot, { throwIfNoEntry: false });
    if (!stats?.isDirectory()) {
      existingWatcher?.close();
      registration.watchers.delete(dependencyRoot);
      return;
    }
    if (!existingWatcher) watchDirectory(registration, dependencyRoot);
  };

  const watchCreatedDirectory = (registration: WatchedRegistration, eventPath: string) => {
    if (eventPath === join(registration.sourcePath, "node_modules")) {
      if (watchDependencies) watchDependencyRoot(registration);
      return;
    }
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
    const dependencyRoot = join(registration.sourcePath, "node_modules");
    const isDependencyEvent = directoryPath === dependencyRoot || eventPath === dependencyRoot;
    const includedIgnoredPath = relativePath && input.includeIgnoredPath?.(relativePath);
    if (!isDependencyEvent && relativePath && registration.matcher.ignores(relativePath) && !includedIgnoredPath)
      return;

    if (directoryPath !== dependencyRoot) watchCreatedDirectory(registration, eventPath);
    scheduleReload(registration);
  };

  const addRegistration = (row: InstalledSourceRegistration) => {
    const registration: WatchedRegistration = {
      identity: sourceIdentity(row.source_path),
      matcher: createExtensionIgnoreMatcher(row.source_path),
      queued: false,
      running: false,
      sourcePath: row.source_path,
      timer: null,
      watchers: new Map(),
    };

    registrations.set(row.source_path, registration);
    watchDirectoryTree(registration, row.source_path);
    if (watchDependencies) watchDependencyRoot(registration);
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
      await input.onSourceChanged(sourcePath);
    } catch (error) {
      input.onError?.(error);
    }
  };

  const refresh = async (sourcePath?: string) => {
    if (disposed) return;

    const rows = await input.listInstalledSources();

    if (sourcePath) {
      const registration = registrations.get(sourcePath);
      if (registration) await refreshRegistration(sourcePath, registration, rows);

      const row = rows.find((candidate) => candidate.source_path === sourcePath);
      if (row && !registrations.has(sourcePath)) addRegistration(row);
      return;
    }

    for (const [registeredSourcePath, registration] of registrations) {
      await refreshRegistration(registeredSourcePath, registration, rows);
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
