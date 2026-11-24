import { watch as fsWatch, lstatSync, readdirSync } from "node:fs";
import { basename, join, relative, sep } from "node:path";
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

const watchFlatDependencyDirectory: WatchDirectory = (path, listener, onError) => {
  const watcher = fsWatch(path, { recursive: false }, listener);
  watcher.on("error", onError);
  return watcher;
};

const defaultDebounceMs = 100;

const isMissingEntry = (path: string) => {
  try {
    return lstatSync(path, { throwIfNoEntry: false }) === undefined;
  } catch {
    return false;
  }
};

// Watch registration walks the source tree itself, so it must never descend into
// dependency or VCS trees: node_modules symlinks back into the monorepo store,
// and recursively registering that (Linux has no native recursive fs.watch)
// crawls hundreds of thousands of entries — enough to hang a CI job.
const skippedDirectoryNames = new Set(["node_modules", ".git"]);

type WatchedRegistration = {
  dependencyHandles: Map<string, DirectoryWatchHandle>;
  identity: string;
  matcher: ExtensionIgnoreMatcher;
  lastDependencyChange?: { path: string; identity: string };
  queued: false | "metadata" | "source";
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
  onSourceChanged: (sourcePath: string, change?: { kind: "metadata" | "source" }) => Promise<unknown>;
  watch?: WatchDirectory;
  watchDependencies?: boolean;
};

const sourceIdentity = (sourcePath: string) => {
  const stats = lstatSync(sourcePath, { bigint: true });
  return [stats.dev.toString(), stats.ino.toString(), stats.birthtimeNs.toString()].join(":");
};

const dependencyEventIdentity = (path: string) => {
  try {
    return sourceIdentity(path);
  } catch {
    return "missing";
  }
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
  const watchDirectDependencies = process.platform === "darwin" && !input.watch;
  // FSEvents can omit scoped directory changes. A flat watch gets the immediate
  // membership change without subscribing to files inside each package.
  const watch = input.watch ?? (watchDirectDependencies ? watchFlatDependencyDirectory : watchDirectory);
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
    if (registration.running) return;

    const kind = registration.queued || "source";
    registration.queued = false;
    // Uninstall removes the folder before its root watcher updates registrations.
    // A queued edit no longer owns source bytes to hash, build or provision.
    if (isMissingEntry(registration.sourcePath)) return;
    registration.running = true;
    input
      .onSourceChanged(registration.sourcePath, { kind })
      .catch((error) => input.onError?.(error))
      .finally(() => {
        registration.running = false;
        if (disposed || registrations.get(registration.sourcePath) !== registration) return;
        if (!registration.queued) return;

        scheduleReload(registration);
      });
  };

  const scheduleReload = (registration: WatchedRegistration, kind?: "metadata" | "source") => {
    if (kind) registration.queued = registration.queued === "source" ? "source" : kind;
    if (registration.timer) clearTimeout(registration.timer);

    registration.timer = setTimeout(() => {
      registration.timer = null;
      runReload(registration);
    }, debounceMs);
  };

  const watchDependencyRoot = (registration: WatchedRegistration) => {
    if (registration.tree.recursive && !watchDirectDependencies) return;
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
        let handle: DirectoryWatchHandle | undefined;
        let failed = false;
        const owned = () =>
          !disposed &&
          registrations.get(registration.sourcePath) === registration &&
          handle !== undefined &&
          registration.dependencyHandles.get(path) === handle;
        handle = watch(
          path,
          (eventType, filename) => {
            if (owned()) handleSourceEvent(registration, eventType, resolveWatchEventPath(path, filename));
          },
          (error) => {
            failed = true;
            if (owned()) {
              registration.dependencyHandles.delete(path);
              handle?.close();
            }
            reportError(error);
          },
        );
        if (failed) handle.close();
        else registration.dependencyHandles.set(path, handle);
      } catch (error) {
        reportError(error);
      }
    }
  };

  const handleDependencyEvent = (
    registration: WatchedRegistration,
    eventType: string,
    eventPath: string,
    segments: string[],
  ) => {
    const packageDepth = segments[1]?.startsWith("@") ? 3 : 2;
    // Windows also reports parent directory metadata when package contents change.
    if (!watchDependencies || eventType !== "rename" || segments.length > packageDepth) return;
    const root = join(registration.sourcePath, "node_modules");
    if (segments.length < packageDepth || !registration.dependencyHandles.has(root)) watchDependencyRoot(registration);
    if (watchDirectDependencies) {
      const identity = dependencyEventIdentity(eventPath);
      const previous = registration.lastDependencyChange;
      if (previous?.path === eventPath && previous.identity === identity) return;
      registration.lastDependencyChange = { path: eventPath, identity };
    }
    scheduleReload(registration, "source");
  };

  const handleSourceEvent = (registration: WatchedRegistration, eventType: string, eventPath: string) => {
    const relativePath = relative(registration.sourcePath, eventPath);
    const segments = relativePath.split(sep);
    if (segments[0] === "node_modules") return handleDependencyEvent(registration, eventType, eventPath, segments);
    const includedIgnoredPath = relativePath && input.includeIgnoredPath?.(relativePath);
    if (relativePath && registration.matcher.ignores(relativePath) && !includedIgnoredPath) return;

    // Some native watches name a root metadata event like a child of itself.
    // Keep the check, but do not turn unchanged bytes into another live edit.
    const metadata =
      eventType === "change" && relativePath === basename(registration.sourcePath) && isMissingEntry(eventPath);
    scheduleReload(registration, metadata ? "metadata" : "source");
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
    rebind = false,
  ) => {
    const next = rows.find((row) => row.source_path === sourcePath);
    if (!next) {
      disposeRegistration(registration);
      registrations.delete(sourcePath);
      return;
    }
    if (!rebind && sourceIdentity(sourcePath) === registration.identity) return;

    disposeRegistration(registration);
    registrations.delete(sourcePath);
    addRegistration(next);
    try {
      await input.onSourceChanged(sourcePath, { kind: "source" });
    } catch (error) {
      input.onError?.(error);
    }
  };

  const refreshSource = async (sourcePath: string, rows: InstalledSourceRegistration[]) => {
    const registration = registrations.get(sourcePath);
    // A named refresh signals a source change even when the filesystem reuses its identity.
    if (registration) await refreshRegistration(sourcePath, registration, rows, true);
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
