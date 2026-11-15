import { inspectExtensionLoadKey, prepareExtensionRevision, readAcceptedRevision } from "pstdio-extensions";
import { hashRevisionSource } from "pstdio-extensions/revision-dependencies";
import { runExtensionPreparation } from "./extension-preparation";
import { type LoadedExtension, type LoadedExtensionSnapshot, loadExtensionSource } from "./extension-runtime";

export const inspectWebviewSource = (sourcePath: string) =>
  runExtensionPreparation<LoadedExtension>("source.inspect", { sourcePath });

export const inspectWebviewLoadKey = (sourcePath: string) =>
  runExtensionPreparation<string>("source.webview-key", { sourcePath });

export const inspectWebviewLoadKeyInWorker = async (input: { sourcePath: string }) => {
  const accepted = await readAcceptedRevision(input.sourcePath);
  // Runtime dependencies are frozen. Own bytes separate edits; frontend dependency
  // and compiler inputs still have fresh whole-batch guards before publication.
  return accepted
    ? `accepted:${accepted.id}:${hashRevisionSource(input.sourcePath)}`
    : inspectExtensionLoadKey(input.sourcePath);
};

export const isWebviewSnapshotCurrent = async (sourcePath: string, snapshot: LoadedExtensionSnapshot, key: string) => {
  const runtimeId = snapshot.loaded.preparedRevision?.id;
  if (!key.startsWith("accepted:")) return snapshot.loadKey === key;
  if (!runtimeId || !key.startsWith(`accepted:${runtimeId}:`)) return false;
  // Explicit adoption has already accepted its supplied candidate. Bind that
  // immutable metadata to the current own-source guard, then keep the same guard.
  if (snapshot.loadKey !== key && snapshot.loadKey !== runtimeId) return false;
  return (await readAcceptedRevision(sourcePath))?.id === runtimeId;
};

const inspections = new Map<string, { id: string; loaded: LoadedExtension }>();
// Asset refresh belongs to the adopted contribution graph. Preparing a new mutable
// runtime here would both inspect unadopted callbacks and detach frontend acceptance
// from the runtime revision that serving still uses.
export const inspectWebviewSourceInWorker = async (input: { sourcePath: string }) => {
  const revision = (await readAcceptedRevision(input.sourcePath)) ?? (await prepareExtensionRevision(input.sourcePath));
  const cached = inspections.get(input.sourcePath);
  if (cached?.id === revision.id) return cached.loaded;
  const loaded = JSON.parse(
    JSON.stringify(await loadExtensionSource(input.sourcePath, { preparedRevision: revision })),
  ) as LoadedExtension;
  inspections.set(input.sourcePath, { id: revision.id, loaded });
  return loaded;
};
