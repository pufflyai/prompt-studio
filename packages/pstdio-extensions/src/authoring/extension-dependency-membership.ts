import { lstatSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dependencyProbeIntervalMs = 500;

export const readDependencyScopePaths = (root: string) =>
  readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.name.startsWith("@") && entry.isDirectory())
    .map((entry) => join(root, entry.name));

const readDirectoryStamp = (path: string) => {
  try {
    const stat = lstatSync(path, { bigint: true, throwIfNoEntry: false });
    return stat?.isDirectory() ? `${stat.dev}:${stat.ino}:${stat.birthtimeNs}:${stat.mtimeNs}` : undefined;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOTDIR") return;
    throw error;
  }
};

export const watchDependencyMembership = (root: string, onChange: () => void, onError: (error: unknown) => void) => {
  let rootStamp: string | undefined;
  let scopeStamps = new Map<string, string | undefined>();
  let lastReadError: string | undefined;

  const observeScope = (path: string) => {
    const stamp = readDirectoryStamp(path);
    const changed = stamp !== scopeStamps.get(path);
    scopeStamps.set(path, stamp);
    return changed;
  };

  const observeRoot = () => {
    const stamp = readDirectoryStamp(root);
    if (stamp === rootStamp) return false;
    const scopes = stamp ? readDependencyScopePaths(root) : [];
    scopeStamps = new Map(
      scopes.map((path) => [path, scopeStamps.has(path) ? scopeStamps.get(path) : readDirectoryStamp(path)]),
    );
    rootStamp = stamp;
    return true;
  };

  const observe = (directory?: string) => {
    try {
      if (directory && scopeStamps.has(directory)) return observeScope(directory);
      let changed = observeRoot();
      if (!directory) {
        for (const path of scopeStamps.keys()) {
          if (observeScope(path)) changed = true;
        }
      }
      lastReadError = undefined;
      return changed;
    } catch (error) {
      // A package manager can remove the root after we read its stamp.
      const { code, message } = error as NodeJS.ErrnoException;
      if (code !== "ENOENT" && code !== "ENOTDIR" && lastReadError !== message) {
        lastReadError = message;
        onError(error);
      }
      return false;
    }
  };

  // Establish a baseline before watch registration returns. Native events can
  // consume it sooner, without adding paths to Bun's shared FSEvents stream.
  observe();
  const timer = setInterval(() => {
    if (observe()) onChange();
  }, dependencyProbeIntervalMs);
  timer.unref();
  return { observe, close: () => clearInterval(timer) };
};
