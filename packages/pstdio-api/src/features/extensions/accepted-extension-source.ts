import { realpathSync } from "node:fs";
import { type PreparedExtensionRevision, readAcceptedRevision } from "pstdio-extensions";
import type { LoadedExtension } from "./extension-runtime";

const loadedByPath = new Map<string, { key: string; loaded: LoadedExtension }>();
const loadingByPath = new Map<string, Map<string | null, Promise<LoadedExtension>>>();
const revisionKey = (revision: PreparedExtensionRevision | null) =>
  revision ? JSON.stringify([revision.host, revision.id, revision.entryPath]) : null;

// Discovery shares accepted callbacks across projects. Authoring/check loads deliberately
// remain outside this cache so a failed evaluation can recover without editing its source.
export const loadAcceptedExtensionSource = async (
  sourcePath: string,
  load: (accepted: PreparedExtensionRevision | null) => Promise<LoadedExtension>,
): Promise<LoadedExtension> => {
  let path = sourcePath;
  try {
    path = realpathSync(sourcePath);
  } catch {}
  const accepted = await readAcceptedRevision(sourcePath);
  const key = revisionKey(accepted);
  const cached = loadedByPath.get(path);
  if (key && cached?.key === key) return cached.loaded;
  const pending = loadingByPath.get(path) ?? new Map<string | null, Promise<LoadedExtension>>();
  const current = pending.get(key);
  if (current) return current;
  const admission = pending.get(null);
  if (admission) {
    await admission;
    // Admission can publish the marker before its successful result reaches this cache.
    // Re-read it after joining: a different revision may also have been accepted meanwhile.
    return loadAcceptedExtensionSource(sourcePath, load);
  }
  const loading = load(accepted)
    .then(async (loaded) => {
      if (loaded.preparedRevision && !loaded.diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
        const actual = revisionKey(await readAcceptedRevision(sourcePath));
        // An install can accept a newer revision while this import is evaluating.
        if (actual && actual === revisionKey(loaded.preparedRevision)) loadedByPath.set(path, { key: actual, loaded });
      }
      return loaded;
    })
    .finally(() => {
      if (pending.get(key) === loading) pending.delete(key);
      if (pending.size === 0 && loadingByPath.get(path) === pending) loadingByPath.delete(path);
    });
  pending.set(key, loading);
  loadingByPath.set(path, pending);
  return loading;
};
