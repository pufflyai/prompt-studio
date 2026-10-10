import { watch as fsWatch, lstatSync, readdirSync } from "node:fs";
import { basename, isAbsolute, join, sep } from "node:path";

export type DirectoryWatchHandle = {
  close: () => void;
};

export type DirectoryWatchListener = (eventType: string, filename: string | Buffer | null) => void;

export type WatchDirectory = (
  path: string,
  listener: DirectoryWatchListener,
  onError: (error: unknown) => void,
) => DirectoryWatchHandle;

// macOS and Windows provide recursive notifications from one root handle. This
// avoids the macOS gap while a new child watcher starts, and keeps child handles
// from preventing directory replacement on Windows.
export const supportsNativeRecursiveWatch = process.platform === "win32" || process.platform === "darwin";

// An FSWatcher error with no listener is thrown as an uncaught exception, which stops serve.
export const watchDirectory: WatchDirectory = (path, listener, onError) => {
  const watcher = fsWatch(path, { recursive: supportsNativeRecursiveWatch }, listener);
  watcher.on("error", onError);
  return watcher;
};

// lstat throws ENOTDIR when a parent folder was replaced by a file. Either way the path is gone.
const readStats = (path: string) => {
  try {
    return lstatSync(path, { throwIfNoEntry: false });
  } catch {
    return undefined;
  }
};

const isGone = (error: unknown) => ["ENOENT", "ENOTDIR"].includes((error as NodeJS.ErrnoException).code ?? "");

export const resolveWatchEventPath = (directoryPath: string, filename: string | Buffer | null) => {
  if (!filename) return directoryPath;
  const value = filename.toString();
  return isAbsolute(value) ? value : join(directoryPath, value);
};

export type DirectoryTreeWatcherInput = {
  root: string;
  onEvent: (eventType: string, path: string) => void;
  onError: (error: unknown) => void;
  /** Folders a per-folder watch must not enter. Linked folders are never entered. */
  skipDirectory?: (path: string) => boolean;
  /** Per-folder watches stop adding handles past this count. */
  maxDirectories?: number;
  onDirectoryLimit?: () => void;
  /** An injected watch always runs one handle per folder. */
  watch?: WatchDirectory;
};

// Linux cannot watch a folder that does not exist, and nothing above the root is watched. A
// removed root is checked for once per interval until it is back.
const ROOT_RETURN_CHECK_MS = 1_000;

type WatchedFolder = { identity: string; handle?: DirectoryWatchHandle };

// Linux reuses a removed folder's inode at once, so the birth time tells a new folder apart.
const folderIdentity = (path: string) => {
  try {
    const stats = lstatSync(path, { bigint: true, throwIfNoEntry: false });
    return stats?.isDirectory() ? `${stats.dev}:${stats.ino}:${stats.birthtimeNs}` : undefined;
  } catch {
    return undefined;
  }
};

/**
 * Watch a folder tree with the platform's best strategy: one recursive handle on macOS and
 * Windows, and one handle per folder elsewhere. Linux has no native recursive watch, and its
 * recursive emulation crawls everything, including linked dependency trees (lesson 0012).
 */
export const createDirectoryTreeWatcher = (input: DirectoryTreeWatcherInput) => {
  const watch = input.watch ?? watchDirectory;
  const recursive = supportsNativeRecursiveWatch && !input.watch;
  const maxDirectories = input.maxDirectories ?? Number.POSITIVE_INFINITY;
  const folders = new Map<string, WatchedFolder>();
  let rootCheck: ReturnType<typeof setInterval> | null = null;
  let limitReported = false;
  let closed = false;

  const addHandle = (directoryPath: string) => {
    if (folders.has(directoryPath)) return true;
    if (folders.size >= maxDirectories) {
      if (!limitReported) input.onDirectoryLimit?.();
      limitReported = true;
      return false;
    }
    const identity = folderIdentity(directoryPath);
    // A folder removed before its handle starts is reported by its parent.
    if (!identity) return true;
    try {
      const folder: WatchedFolder = { identity };
      folder.handle = watch(
        directoryPath,
        (eventType, filename) => handleEvent(directoryPath, folder, eventType, filename),
        input.onError,
      );
      folders.set(directoryPath, folder);
    } catch (error) {
      input.onError(error);
    }
    return true;
  };

  // A new folder can fill up before its handle starts. Its entries are reported as changed, so
  // nothing written in that gap is lost.
  const watchFolders = (startPath: string, reportEntries: boolean) => {
    const visit = (directoryPath: string): boolean => {
      if (!addHandle(directoryPath)) return false;
      for (const entry of readdirSync(directoryPath, { withFileTypes: true })) {
        const path = join(directoryPath, entry.name);
        // Dirent.isDirectory() does not follow links, so linked folders are skipped.
        const folder = entry.isDirectory();
        if (folder && input.skipDirectory?.(path)) continue;
        if (reportEntries) input.onEvent("rename", path);
        if (folder && !visit(path)) return false;
      }
      return true;
    };

    try {
      visit(startPath);
    } catch (error) {
      // A folder removed during the walk is reported by its own event.
      if (!isGone(error)) input.onError(error);
    }
  };

  const watchCreatedFolder = (path: string) => {
    if (folders.has(path) || input.skipDirectory?.(path)) return;
    if (!readStats(path)?.isDirectory()) return;
    watchFolders(path, true);
  };

  const forgetFolder = (path: string) => {
    for (const [watchedPath, folder] of folders) {
      if (watchedPath !== path && !watchedPath.startsWith(path + sep)) continue;
      folder.handle?.close();
      folders.delete(watchedPath);
    }
  };

  const watchRootWhenBack = () => {
    if (folderIdentity(input.root)) {
      watchFolders(input.root, true);
      return;
    }
    rootCheck ??= setInterval(() => {
      if (!folderIdentity(input.root)) return;
      if (rootCheck) clearInterval(rootCheck);
      rootCheck = null;
      watchFolders(input.root, true);
      input.onEvent("rename", input.root);
    }, ROOT_RETURN_CHECK_MS);
    rootCheck.unref?.();
  };

  // A per-folder handle watches one folder object. Once that folder is removed or replaced, the
  // handle reports nothing more, so it is dropped and the path is watched again when it is back.
  const handleLostFolder = (directoryPath: string, eventType: string, filename: string | Buffer | null) => {
    forgetFolder(directoryPath);
    // Linux names a folder's own removal like a child of itself.
    if (filename?.toString() !== basename(directoryPath)) {
      input.onEvent(eventType, resolveWatchEventPath(directoryPath, filename));
    }
    input.onEvent(eventType, directoryPath);
    if (directoryPath === input.root) watchRootWhenBack();
    else watchCreatedFolder(directoryPath);
  };

  const handleEvent = (
    directoryPath: string,
    folder: WatchedFolder,
    eventType: string,
    filename: string | Buffer | null,
  ) => {
    // A dropped handle can still deliver events that were already queued.
    if (closed || folders.get(directoryPath) !== folder) return;
    const path = resolveWatchEventPath(directoryPath, filename);
    if (recursive) {
      input.onEvent(eventType, path);
      return;
    }
    if (folderIdentity(directoryPath) !== folder.identity) {
      handleLostFolder(directoryPath, eventType, filename);
      return;
    }
    watchCreatedFolder(path);
    input.onEvent(eventType, path);
  };

  if (recursive) addHandle(input.root);
  else watchFolders(input.root, false);

  return {
    recursive,
    close: () => {
      closed = true;
      if (rootCheck) clearInterval(rootCheck);
      for (const folder of folders.values()) folder.handle?.close();
      folders.clear();
    },
  };
};

export type DirectoryTreeWatcher = ReturnType<typeof createDirectoryTreeWatcher>;
