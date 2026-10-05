import { watch as fsWatch, mkdirSync } from "node:fs";

type SourceWatcher = {
  close: () => void;
};

type WatchListener = (eventType: string, filename: string | Buffer | null) => void;
type WatchSource = (path: string, listener: WatchListener, onError: (error: Error) => void) => SourceWatcher;

type ExtensionRootRegistration = {
  path: string;
  sync: () => Promise<unknown>;
};

type WatchedRootRegistration = ExtensionRootRegistration & {
  queued: boolean;
  running: boolean;
  timer: ReturnType<typeof setTimeout> | null;
  watcher: SourceWatcher;
};

export type ExtensionRootWatcher = {
  dispose: () => void;
  refresh: () => Promise<void>;
};

export type CreateExtensionRootWatcherInput = {
  debounceMs?: number;
  ensureRoot?: (path: string) => void;
  listExtensionRoots: () => Promise<ExtensionRootRegistration[]>;
  onError?: (error: unknown) => void;
  watch?: WatchSource;
};

const defaultEnsureRoot = (path: string) => mkdirSync(path, { recursive: true });
// An FSWatcher error with no listener is thrown as an uncaught exception, which stops serve.
const defaultWatch: WatchSource = (path, listener, onError) => {
  const watcher = fsWatch(path, listener);
  watcher.on("error", onError);
  return watcher;
};

export const createExtensionRootWatcher = async (
  input: CreateExtensionRootWatcherInput,
): Promise<ExtensionRootWatcher> => {
  const debounceMs = input.debounceMs ?? 150;
  const ensureRoot = input.ensureRoot ?? defaultEnsureRoot;
  const registrations = new Map<string, WatchedRootRegistration>();
  const watch = input.watch ?? defaultWatch;
  let disposed = false;

  const disposeRegistration = (registration: WatchedRootRegistration) => {
    registration.queued = false;
    if (registration.timer) clearTimeout(registration.timer);
    registration.watcher.close();
  };

  const runSync = (registration: WatchedRootRegistration) => {
    if (disposed) return;
    if (registration.running) {
      registration.queued = true;
      return;
    }

    registration.running = true;
    registration
      .sync()
      .catch((error) => input.onError?.(error))
      .finally(() => {
        registration.running = false;
        if (disposed || registrations.get(registration.path) !== registration) return;
        if (!registration.queued) return;

        registration.queued = false;
        scheduleSync(registration);
      });
  };

  const scheduleSync = (registration: WatchedRootRegistration) => {
    if (disposed) return;
    if (registration.timer) clearTimeout(registration.timer);

    registration.timer = setTimeout(() => {
      registration.timer = null;
      runSync(registration);
    }, debounceMs);
  };

  // A failed watcher is dropped, so the next refresh watches the root again. A late error from a
  // watcher that was already replaced must not drop its healthy replacement.
  const handleWatchError = (path: string, failed: SourceWatcher, error: Error) => {
    const registration = registrations.get(path);
    if (registration && registration.watcher === failed) {
      disposeRegistration(registration);
      registrations.delete(path);
    }
    input.onError?.(error);
  };

  const addRegistration = (root: ExtensionRootRegistration) => {
    try {
      ensureRoot(root.path);
      const watcher: SourceWatcher = watch(
        root.path,
        () => {
          const registration = registrations.get(root.path);
          if (registration) scheduleSync(registration);
        },
        (error) => handleWatchError(root.path, watcher, error),
      );
      registrations.set(root.path, { ...root, queued: false, running: false, timer: null, watcher });
    } catch (error) {
      input.onError?.(error);
    }
  };

  const refresh = async () => {
    if (disposed) return;

    const roots = await input.listExtensionRoots();
    if (disposed) return;
    const nextPaths = new Set(roots.map((root) => root.path));

    for (const [path, registration] of registrations) {
      if (nextPaths.has(path)) continue;
      disposeRegistration(registration);
      registrations.delete(path);
    }

    for (const root of roots) {
      const existing = registrations.get(root.path);
      if (existing) {
        existing.sync = root.sync;
        continue;
      }
      addRegistration(root);
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
