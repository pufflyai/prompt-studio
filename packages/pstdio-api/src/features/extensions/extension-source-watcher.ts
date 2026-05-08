import { watch as fsWatch } from "node:fs";
import { isAbsolute, relative } from "node:path";
import { createExtensionIgnoreMatcher, type ExtensionIgnoreMatcher } from "./extension-ignore";

type InstalledSourceRegistration = {
  install_name: string;
  source_path: string;
};

type SourceWatcher = {
  close: () => void;
};

type WatchListener = (eventType: string, filename: string | Buffer | null) => void;
type WatchSource = (path: string, listener: WatchListener) => SourceWatcher;

type WatchedRegistration = {
  installName: string;
  matcher: ExtensionIgnoreMatcher;
  sourcePath: string;
  timer: ReturnType<typeof setTimeout> | null;
  watcher: SourceWatcher;
};

export type ExtensionSourceWatcher = {
  dispose: () => void;
  refresh: () => Promise<void>;
};

export type CreateExtensionSourceWatcherInput = {
  debounceMs?: number;
  listInstalledSources: () => Promise<InstalledSourceRegistration[]>;
  onError?: (error: unknown) => void;
  reloadInstalledSource: (installName: string) => Promise<unknown>;
  watch?: WatchSource;
};

const defaultWatch: WatchSource = (path, listener) => fsWatch(path, { recursive: true }, listener);

const toRelativeEventPath = (sourcePath: string, filename: string | Buffer | null) => {
  if (!filename) return null;
  const value = filename.toString();
  return isAbsolute(value) ? relative(sourcePath, value) : value;
};

export const createExtensionSourceWatcher = async (
  input: CreateExtensionSourceWatcherInput,
): Promise<ExtensionSourceWatcher> => {
  const debounceMs = input.debounceMs ?? 100;
  const registrations = new Map<string, WatchedRegistration>();
  const watch = input.watch ?? defaultWatch;
  let disposed = false;

  const disposeRegistration = (registration: WatchedRegistration) => {
    if (registration.timer) clearTimeout(registration.timer);
    registration.watcher.close();
  };

  const scheduleReload = (registration: WatchedRegistration) => {
    if (registration.timer) clearTimeout(registration.timer);

    registration.timer = setTimeout(() => {
      registration.timer = null;
      input.reloadInstalledSource(registration.installName).catch((error) => input.onError?.(error));
    }, debounceMs);
  };

  const addRegistration = (row: InstalledSourceRegistration) => {
    const matcher = createExtensionIgnoreMatcher(row.source_path);
    let watcher: SourceWatcher;

    try {
      watcher = watch(row.source_path, (_eventType, filename) => {
        const relativePath = toRelativeEventPath(row.source_path, filename);
        if (relativePath && matcher.ignores(relativePath)) return;

        const registration = registrations.get(row.install_name);
        if (registration) scheduleReload(registration);
      });
    } catch (error) {
      input.onError?.(error);
      return;
    }

    registrations.set(row.install_name, {
      installName: row.install_name,
      matcher,
      sourcePath: row.source_path,
      timer: null,
      watcher,
    });
  };

  const refresh = async () => {
    if (disposed) return;

    const rows = await input.listInstalledSources();

    for (const [installName, registration] of registrations) {
      const next = rows.find((row) => row.install_name === installName);
      if (!next || next.source_path !== registration.sourcePath) {
        disposeRegistration(registration);
        registrations.delete(installName);
      }
    }

    for (const row of rows) {
      if (!registrations.has(row.install_name)) addRegistration(row);
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
