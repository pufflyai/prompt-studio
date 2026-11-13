import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { createMarmaladeState } from "./marmalade-data";
import type { MarmaladeHistory } from "./marmalade-history";
import { marmaladeLayerIndex, reconcileMarmaladePresentation } from "./marmalade-presentation";
import {
  type MarmaladeDocumentRecord,
  type MarmaladePresentationRecord,
  marmaladeKeys,
  marmaladePresentationRecord,
} from "./marmalade-storage-values";

export {
  assertMarmaladeSaved,
  marmaladeDocumentEdits,
  marmaladeJson,
  marmaladeKeys,
  marmaladePresentationEdits,
  marmaladePresentationRecord,
} from "./marmalade-storage-values";
export const readMarmaladePresentationRecord = async (storage: ExtensionStorageApi) => {
  const recordId = storage.records.id(marmaladeKeys.presentation);
  const record = await storage.records.read(recordId);
  const saved = record.exists && !record.deleted ? (record.value as unknown as MarmaladePresentationRecord) : undefined;
  const initial = marmaladePresentationRecord(createMarmaladeState());
  const value = {
    ...initial,
    ...saved,
    values: {
      ...initial.values,
      ...saved?.values,
      pan: { ...initial.values.pan, ...saved?.values?.pan },
    },
  };
  return { ...value, values: reconcileMarmaladePresentation(value.values, value.layers) };
};
export const readMarmaladeDocument = async (storage: ExtensionStorageApi) => {
  const presentation = await readMarmaladePresentationRecord(storage);
  const [record, savedHistory] = await Promise.all([
    storage.records.read(storage.records.id(marmaladeKeys.document)),
    storage.records.read(storage.records.id(marmaladeKeys.history)),
  ]);
  const stored = record.exists && !record.deleted ? (record.value as unknown as MarmaladeDocumentRecord) : undefined;
  // Records contain authored fields; the bundled scene supplies untouched fields without a write.
  const document = { ...createMarmaladeState().document, ...stored?.document };
  const values = reconcileMarmaladePresentation(presentation.values, marmaladeLayerIndex(document));
  const history: MarmaladeHistory = {
    past: [],
    future: [],
    boundary: "",
    ...(savedHistory.exists && !savedHistory.deleted ? (savedHistory.value as unknown as MarmaladeHistory) : {}),
  };
  return { state: { document, ...values }, history, presentation };
};
export const marmaladeViewState = (
  state: Awaited<ReturnType<typeof readMarmaladeDocument>>["state"],
  history: MarmaladeHistory,
) => ({
  ...state,
  history: { undo: history.past.length, redo: history.future.length, boundary: history.boundary },
});
const pending = new Map<string, Promise<unknown>>();
/** All read and mutation entry points retain the existing same-host domain order. */
export const inMarmaladeOrder = async <T>(projectId: string, run: () => Promise<T>) => {
  const next = (pending.get(projectId) ?? Promise.resolve()).catch(() => undefined).then(run);
  pending.set(projectId, next);
  try {
    return await next;
  } finally {
    if (pending.get(projectId) === next) pending.delete(projectId);
  }
};
