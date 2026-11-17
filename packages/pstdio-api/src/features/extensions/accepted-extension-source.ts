import { realpathSync } from "node:fs";
import { type PreparedExtensionRevision, readAcceptedRevision } from "pstdio-extensions";
import type { LoadedExtension } from "./extension-runtime";

const loadedByPath = new Map<string, { key: string; loaded: LoadedExtension }>();
type PendingLoad = { promise: Promise<LoadedExtension>; acceptance: { key: string | null } };
const loadingByPath = new Map<string, Map<string | null, PendingLoad>>();
const retainedSourceLimit = 128;
const revisionKey = (revision: PreparedExtensionRevision | null) =>
  revision ? JSON.stringify([revision.host, revision.id, revision.entryPath]) : null;

const retainLoadedSource = (path: string, entry: { key: string; loaded: LoadedExtension }) => {
  loadedByPath.delete(path);
  loadedByPath.set(path, entry);
  if (loadedByPath.size > retainedSourceLimit) loadedByPath.delete(loadedByPath.keys().next().value!);
};

// Discovery shares accepted callbacks across projects. Authoring/check loads deliberately
// remain outside this cache so a failed evaluation can recover without editing its source.
export const loadAcceptedExtensionSource = async (
  sourcePath: string,
  load: (
    accepted: PreparedExtensionRevision | null,
    markAccepting: (revision: PreparedExtensionRevision) => void,
  ) => Promise<LoadedExtension>,
): Promise<LoadedExtension> => {
  let path = sourcePath;
  try {
    path = realpathSync(sourcePath);
  } catch {}
  const accepted = await readAcceptedRevision(sourcePath);
  const key = revisionKey(accepted);
  const cached = loadedByPath.get(path);
  if (key && cached?.key === key) {
    retainLoadedSource(path, cached);
    return cached.loaded;
  }
  if (cached) loadedByPath.delete(path);
  const pending = loadingByPath.get(path) ?? new Map<string | null, PendingLoad>();
  const current = pending.get(key);
  if (current) return current.promise;
  const admission = pending.get(null);
  if (admission && admission.acceptance.key === key) {
    await admission.promise;
    // Admission can publish the marker before its successful result reaches this cache.
    // Re-read it after joining: a different revision may also have been accepted meanwhile.
    return loadAcceptedExtensionSource(sourcePath, load);
  }
  const acceptance = { key: null as string | null };
  const loading = load(accepted, (revision) => {
    acceptance.key = revisionKey(revision);
  })
    .then(async (loaded) => {
      if (loaded.preparedRevision && !loaded.diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
        const actual = revisionKey(await readAcceptedRevision(sourcePath));
        // An install can accept a newer revision while this import is evaluating.
        if (actual && actual === revisionKey(loaded.preparedRevision))
          retainLoadedSource(path, { key: actual, loaded });
      }
      return loaded;
    })
    .finally(() => {
      if (pending.get(key)?.promise === loading) pending.delete(key);
      if (pending.size === 0 && loadingByPath.get(path) === pending) loadingByPath.delete(path);
    })
    .catch(async (error) => {
      const current = revisionKey(await readAcceptedRevision(sourcePath));
      // A failed compare-and-set can mean a newer revision is already available.
      // The obsolete in-flight entry has been released, so all callers can join the newer load.
      if (current && current !== key) return loadAcceptedExtensionSource(sourcePath, load);
      throw error;
    });
  pending.set(key, { promise: loading, acceptance });
  loadingByPath.set(path, pending);
  return loading;
};
