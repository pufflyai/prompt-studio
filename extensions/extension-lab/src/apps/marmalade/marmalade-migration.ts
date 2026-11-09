import type { ExtensionStorageApi, JsonObject, StorageGroup } from "@pstdio/sdk/extensions";
import type { MarmaladeState } from "./marmalade.types";
import { createMarmaladeState } from "./marmalade-data";
import { marmaladeLayerIndex, marmaladePresentation } from "./marmalade-presentation";
import {
  assertMarmaladeSaved,
  type MarmaladeDocumentRecord,
  type MarmaladePresentationRecord,
  marmaladeJson,
  marmaladeKeys,
  marmaladePointer,
  marmaladePresentationRecord,
} from "./marmalade-storage-values";

interface LegacyImport {
  version: 1;
  sourceRevision: string;
  digests: Record<string, string>;
}
const fieldDigest = async (value: unknown) => {
  const canonical = JSON.stringify(value, (_key, item) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
      : item,
  );
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
};
// Arrays remain whole leaves, exactly as ordinary record replacement merges them.
const sourceLeaves = (state: object, path: string[] = []): [string[], unknown][] =>
  Object.entries(state).flatMap(([key, value]) => {
    const next = [...path, key];
    return value && typeof value === "object" && !Array.isArray(value) ? sourceLeaves(value, next) : [[next, value]];
  });
const sourceDigests = async (state: MarmaladeState) =>
  Object.fromEntries(
    await Promise.all(
      sourceLeaves(state).map(async ([path, value]) => [marmaladePointer(path), await fieldDigest(value)]),
    ),
  );
const readLegacy = async (storage: ExtensionStorageApi) => {
  const record = await storage.records.read(storage.records.id(marmaladeKeys.legacy));
  const saved = record.exists && !record.deleted ? (record.value as unknown as MarmaladeState) : createMarmaladeState();
  const state = { document: saved.document, ...marmaladePresentation(saved) };
  return { record, state };
};

/** The old record is a read-only import source. Modern commands never write it. */
export const ensureMarmaladeStorage = async (storage: ExtensionStorageApi) => {
  const receiptId = storage.records.id(marmaladeKeys.import);
  if ((await storage.records.read(receiptId)).exists) return;
  await storage.scope({ type: "custom", id: "marmalade-presentation" }).migrate(1, async () => {
    if ((await storage.records.read(receiptId)).exists) return;
    const { record, state } = await readLegacy(storage);
    assertMarmaladeSaved(
      await storage.records.commit({
        operationId: storage.ids.create(),
        edits: [
          {
            recordId: storage.records.id(marmaladeKeys.document),
            replace: marmaladeJson({ version: 2, document: state.document }),
          },
          {
            recordId: storage.records.id(marmaladeKeys.presentation),
            replace: marmaladeJson(marmaladePresentationRecord(state)),
          },
          {
            recordId: receiptId,
            replace: marmaladeJson({
              version: 1,
              sourceRevision: record.revision,
              digests: await sourceDigests(state),
            }),
          },
        ],
      }),
    );
  });
};

/** Reconcile delayed pre-upgrade saves at full-load entry points, never during a presentation read. */
const importLegacyAttempt = async (storage: ExtensionStorageApi) => {
  await ensureMarmaladeStorage(storage);
  const [{ record: source, state }, receipt] = await Promise.all([
    readLegacy(storage),
    storage.records.read(storage.records.id(marmaladeKeys.import)),
  ]);
  const previous = receipt.value as unknown as LegacyImport;
  if (source.revision === previous.sourceRevision || source.deleted || !source.exists) return true;
  const digests = await sourceDigests(state);
  const [document, presentation] = await Promise.all([
    storage.records.read(storage.records.id(marmaladeKeys.document)),
    storage.records.read(storage.records.id(marmaladeKeys.presentation)),
  ]);
  const doc = document.value as unknown as MarmaladeDocumentRecord;
  const view = presentation.value as unknown as MarmaladePresentationRecord;
  const documentValues: JsonObject = {};
  const values: JsonObject = {};
  for (const [path, value] of sourceLeaves(state)) {
    const pointer = marmaladePointer(path);
    const target = path[0] === "document" ? doc : view;
    if (digests[pointer] === previous.digests[pointer] || target.authored?.[pointer]) continue;
    if (path[0] === "document") documentValues[pointer] = value as JsonObject[string];
    else values[marmaladePointer(["values", ...path])] = value as JsonObject[string];
  }
  if (Object.hasOwn(documentValues, "/document/id")) values["/documentId"] = state.document.id;
  if (Object.hasOwn(documentValues, "/document/layers"))
    values["/layers"] = marmaladeJson({ layers: marmaladeLayerIndex(state.document) }).layers;
  const edits: StorageGroup["edits"] = [
    {
      recordId: receipt.recordId,
      expectedRevision: receipt.revision,
      replace: marmaladeJson({ version: 1, sourceRevision: source.revision, digests }),
    },
  ];
  if (Object.keys(documentValues).length)
    edits.push({
      recordId: document.recordId,
      expectedRevision: document.revision,
      set: documentValues,
    });
  if (Object.keys(values).length)
    edits.push({ recordId: presentation.recordId, expectedRevision: presentation.revision, set: values });
  const outcome = await storage.records.commit({ operationId: storage.ids.create(), edits });
  if (outcome.state === "refused") return false;
  assertMarmaladeSaved(outcome);
  return true;
};

export const importMarmaladeLegacy = async (storage: ExtensionStorageApi) => {
  // Another authorized host may finish the same import. Re-read once; persistent
  // contention remains observable rather than creating an unbounded retry loop.
  for (let attempt = 0; attempt < 2; attempt++) {
    if (!(await storage.canMigrate())) return;
    if (await importLegacyAttempt(storage)) return;
  }
  throw new Error("Marmalade changed during its upgrade. Retry the read.");
};
