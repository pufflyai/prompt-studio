import type { StorageOwner } from "pstdio-sync";
import {
  applyJsonChanges,
  hasEarlierRecordLifetime,
  jsonPointer,
  type OrderedRecord,
  type OrderedTextState,
  parseJsonPointer,
  recordLifetime,
  retainedResourceBody,
} from "pstdio-sync/records";
import { readTextDocumentSeed } from "pstdio-sync/text";
import type { Json } from "pstdio-sync-contracts";
import * as Y from "yjs";
import type { NativeProjectedRecord } from "./native-record-projection";
import { nativeDocumentId } from "./native-record-projection";
import { orderedFieldMarkerId, saveOrderedMarker } from "./ordered-native-metadata";
import type { OrderedTransaction } from "./ordered-sql";
import { loadResourceDocuments, resourceDocumentId } from "./resource-document-persistence";

const legacyBody = async (tx: OrderedTransaction, owner: StorageOwner, record: NativeProjectedRecord) => {
  let body = {
    value: record.value,
    asset: record.asset,
    shared: record.shared,
    nativeSources: record.nativeSources ?? {},
  };
  let lifetime = "initial";
  if (record.deleted || Object.keys(body.nativeSources).length) {
    const { sources } = await loadResourceDocuments(tx, owner, [resourceDocumentId(record.recordId)]);
    const saved = sources.get(resourceDocumentId(record.recordId));
    if (!saved) throw new Error("A legacy record is missing retained source history");
    if (record.deleted) body = { ...retainedResourceBody(record.recordId, saved.states), nativeSources: {} };
    else {
      const document = new Y.Doc();
      try {
        for (const update of saved.states) Y.applyUpdate(document, update);
        if (hasEarlierRecordLifetime(document, record.recordId))
          lifetime = JSON.stringify(["canonical", "legacy", recordLifetime(document, record.recordId)]);
      } finally {
        document.destroy();
      }
    }
  }
  return { body, lifetime };
};

/** Read legacy history only for retained tombstones or explicit native ownership facts. */
export const convertLegacyOrderedRecord = async (
  tx: OrderedTransaction,
  owner: StorageOwner,
  record: NativeProjectedRecord,
) => {
  const { body, lifetime } = await legacyBody(tx, owner, record);
  let value = body as unknown as Json;
  const texts: Record<string, OrderedTextState> = {};
  for (const [key, source] of Object.entries(body.nativeSources)) {
    if (!("field" in source)) continue;
    const { sources } = await loadResourceDocuments(tx, owner, [nativeDocumentId(key)]);
    const saved = sources.get(nativeDocumentId(key));
    if (!saved) throw new Error("A legacy native field is missing its shared history");
    const document = new Y.Doc();
    try {
      for (const update of saved.states) Y.applyUpdate(document, update);
      const seed = await readTextDocumentSeed(document);
      const path = ["value", ...parseJsonPointer(source.field)];
      texts[jsonPointer(path)] = {
        seed: seed.id,
        state: Buffer.from(Y.encodeStateAsUpdate(document)).toString("base64"),
        pending: [],
      };
      value = applyJsonChanges(value, [{ path, set: document.getText("content").toString() }]);
      await saveOrderedMarker(tx, owner, orderedFieldMarkerId(key), {
        recordId: record.recordId,
        field: source.field,
        lifetime,
      });
    } finally {
      document.destroy();
    }
  }
  return {
    recordId: record.recordId,
    value,
    deleted: record.deleted,
    lifetime,
    stamps: {},
    ...(Object.keys(texts).length ? { texts } : {}),
  } satisfies OrderedRecord;
};
