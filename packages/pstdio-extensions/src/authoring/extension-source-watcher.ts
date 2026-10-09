import { lstatSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import {
  createDirectoryTreeWatcher,
  type DirectoryTreeWatcher,
  type DirectoryWatchHandle,
  resolveWatchEventPath,
  type WatchDirectory,
  watchDirectory,
} from "../fs-watch/directory-tree-watcher";
import { createExtensionIgnoreMatcher, type ExtensionIgnoreMatcher } from "./extension-ignore";

type InstalledSourceRegistration = {
  install_name: string;
  source_path: string;
};

const defaultDebounceMs = 100;

// Watch registration walks the source tree itself, so it must never descend into
// dependency or VCS trees: node_modules symlinks back into the monorepo store,
// and recursively registering that (Linux has no native recursive fs.watch)
// crawls hundreds of thousands of entries — enough to hang a CI job.
const skippedDirectoryNames = new Set(["node_modules", ".git"]);

type WatchedRegistration = {
  dependencyHandles: Map<string, DirectoryWatchHandle>;
  identity: string;
  matcher: ExtensionIgnoreMatcher;
  queued: boolean;
  running: boolean;
  sourcePath: string;
  timer: ReturnType<typeof setTimeout> | null;
  tree: DirectoryTreeWatcher;
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
  watch?: WatchDirectory;
  watchDependencies?: boolean;
};

const sourceIdentity = (sourcePath: string) => {
  const stats = lstatSync(sourcePath, { bigint: true });
  return [stats.dev.toString(), stats.ino.toString(), stats.birthtimeNs.toString()].join(":");
};

const dependencyWatchDirectories = (dependencyRoot: string) => {
  const directories = new Set<string>();
  try {
    if (!lstatSync(dependencyRoot, { throwIfNoEntry: false })?.isDirectory()) return directories;
    const entries = readdirSync(dependencyRoot, { withFileTypes: true });
    directories.add(dependencyRoot);
    for (const entry of entries) {
      if (entry.name.startsWith("@") && entry.isDirectory()) directories.add(join(dependencyRoot, entry.name));
    }
  } catch (error) {
    // A package manager can remove node_modules between the stat and directory read.
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  return directories;
};

export const createExtensionSourceWatcher = async (
  input: CreateExtensionSourceWatcherInput,
): Promise<ExtensionSourceWatcher> => {
  const debounceMs = input.debounceMs ?? defaultDebounceMs;
  const registrations = new Map<string, WatchedRegistration>();
  const watch = input.watch ?? watchDirectory;
  const reportError = (error: unknown) => input.onError?.(error);
  const watchDependencies = input.watchDependencies ?? true;
  let disposed = false;

  const disposeRegistration = (registration: WatchedRegistration) => {
    registration.queued = false;
    if (registration.timer) clearTimeout(registration.timer);
    registration.tree.close();
    for (const handle of registration.dependencyHandles.values()) handle.close();
    registration.dependencyHandles.clear();
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

  const watchDependencyRoot = (registration: WatchedRegistration) => {
    if (registration.tree.recursive) return;
    const dependencyRoot = join(registration.sourcePath, "node_modules");
    const directories = dependencyWatchDirectories(dependencyRoot);
    for (const [path, handle] of registration.dependencyHandles) {
      if (directories.has(path)) continue;
      handle.close();
      registration.dependencyHandles.delete(path);
    }
    for (const path of directories) {
      if (registration.dependencyHandles.has(path)) continue;
      try {
        const handle = watch(
          path,
          (eventType, filename) => handleSourceEvent(registration, eventType, resolveWatchEventPath(path, filename)),
          reportError,
        );
        registration.dependencyHandles.set(path, handle);
      } catch (error) {
        reportError(error);
      }
    }
  };

  const handleSourceEvent = (registration: WatchedRegistration, eventType: string, eventPath: string) => {
    const relativePath = relative(registration.sourcePath, eventPath);
    const segments = relativePath.split(sep);
    if (segments[0] === "node_modules") {
      const packageDepth = segments[1]?.startsWith("@") ? 3 : 2;
      // Windows also reports parent directory metadata when package contents change.
      if (!watchDependencies || eventType !== "rename" || segments.length > packageDepth) return;
      watchDependencyRoot(registration);
      scheduleReload(registration);
      return;
    }
    const includedIgnoredPath = relativePath && input.includeIgnoredPath?.(relativePath);
    if (relativePath && registration.matcher.ignores(relativePath) && !includedIgnoredPath) return;

    scheduleReload(registration);
  };

  const addRegistration = (row: InstalledSourceRegistration) => {
    const matcher = createExtensionIgnoreMatcher(row.source_path);
    const registration: WatchedRegistration = {
      dependencyHandles: new Map(),
      identity: sourceIdentity(row.source_path),
      matcher,
      queued: false,
      running: false,
      sourcePath: row.source_path,
      timer: null,
      tree: createDirectoryTreeWatcher({
        root: row.source_path,
        onEvent: (eventType, path) => handleSourceEvent(registration, eventType, path),
        onError: reportError,
        skipDirectory: (path) => {
          const relativePath = relative(row.source_path, path);
          return (
            relativePath.split(sep).some((segment) => skippedDirectoryNames.has(segment)) ||
            matcher.ignores(relativePath)
          );
        },
        watch: input.watch,
      }),
    };

    registrations.set(row.source_path, registration);
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

  const refreshSource = async (sourcePath: string, rows: InstalledSourceRegistration[]) => {
    const registration = registrations.get(sourcePath);
    if (registration) await refreshRegistration(sourcePath, registration, rows);
    if (disposed) return;

    const row = rows.find((candidate) => candidate.source_path === sourcePath);
    if (row && !registrations.has(sourcePath)) addRegistration(row);
  };

  const refresh = async (sourcePath?: string) => {
    if (disposed) return;

    const rows = await input.listInstalledSources();
    if (disposed) return;

    if (sourcePath) {
      await refreshSource(sourcePath, rows);
      return;
    }

    for (const [registeredSourcePath, registration] of registrations) {
      await refreshRegistration(registeredSourcePath, registration, rows);
      if (disposed) return;
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
