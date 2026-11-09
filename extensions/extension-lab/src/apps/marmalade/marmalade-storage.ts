import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { createMarmaladeState } from "./marmalade-data";
import type { MarmaladeHistory } from "./marmalade-history";
import { ensureMarmaladeStorage } from "./marmalade-migration";
import { marmaladeLayerIndex, reconcileMarmaladePresentation } from "./marmalade-presentation";
import {
  type MarmaladeDocumentRecord,
  type MarmaladePresentationRecord,
  marmaladeKeys,
} from "./marmalade-storage-values";

export {
  assertMarmaladeSaved,
  marmaladeAuthoredPresentation,
  marmaladeDocumentEdits,
  marmaladeJson,
  marmaladeKeys,
  marmaladePresentationEdits,
  marmaladePresentationRecord,
} from "./marmalade-storage-values";
export const readMarmaladePresentationRecord = async (storage: ExtensionStorageApi) => {
  const recordId = storage.records.id(marmaladeKeys.presentation);
  let record = await storage.records.read(recordId);
  if (!record.exists || record.deleted) {
    await ensureMarmaladeStorage(storage);
    record = await storage.records.read(recordId);
  }
  const value = record.value as unknown as MarmaladePresentationRecord;
  if (!record.exists || record.deleted || value.version !== 1)
    throw new Error("Marmalade presentation storage has not been upgraded");
  return { ...value, values: reconcileMarmaladePresentation(value.values, value.layers) };
};
export const readMarmaladeDocument = async (storage: ExtensionStorageApi) => {
  const presentation = await readMarmaladePresentationRecord(storage);
  const [record, savedHistory] = await Promise.all([
    storage.records.read(storage.records.id(marmaladeKeys.document)),
    storage.records.read(storage.records.id(marmaladeKeys.history)),
  ]);
  const stored = record.exists && !record.deleted ? (record.value as unknown as MarmaladeDocumentRecord) : undefined;
  const document = stored?.document ?? createMarmaladeState().document;
  const values = reconcileMarmaladePresentation(presentation.values, marmaladeLayerIndex(document));
  const history: MarmaladeHistory =
    savedHistory.exists && !savedHistory.deleted
      ? (savedHistory.value as unknown as MarmaladeHistory)
      : { past: [], future: [] };
  return { state: { document, ...values }, history, presentation };
};
export const marmaladeViewState = (
  state: Awaited<ReturnType<typeof readMarmaladeDocument>>["state"],
  history: MarmaladeHistory,
) => ({
  ...state,
  history: { undo: history.past.length, redo: history.future.length },
});
const pending = new Map<string, Promise<unknown>>();
/** All read/upgrade/mutation entry points retain the existing same-host domain order. */
export const inMarmaladeOrder = async <T>(projectId: string, run: () => Promise<T>) => {
  const next = (pending.get(projectId) ?? Promise.resolve()).catch(() => undefined).then(run);
  pending.set(projectId, next);
  try {
    return await next;
  } finally {
    if (pending.get(projectId) === next) pending.delete(projectId);
  }
};
