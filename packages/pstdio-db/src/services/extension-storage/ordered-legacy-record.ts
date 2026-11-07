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
import { fingerprint, type Json } from "pstdio-sync-contracts";
import * as Y from "yjs";
import type { NativeProjectedRecord } from "./native-record-projection";
import { nativeDocumentId } from "./native-record-projection";
import { orderedFieldMarkerId, saveOrderedMarker } from "./ordered-native-metadata";
import type { OrderedTransaction } from "./ordered-sql";
import { loadResourceDocuments, resourceDocumentId } from "./resource-document-persistence";

type Sources = Awaited<ReturnType<typeof loadResourceDocuments>>["sources"];
const legacyBody = async (
  tx: OrderedTransaction,
  owner: StorageOwner,
  record: NativeProjectedRecord,
  sources?: Sources,
) => {
  let body = {
    value: record.value,
    asset: record.asset,
    shared: record.shared,
    nativeSources: record.nativeSources ?? {},
  };
  let lifetime = "initial";
  if (record.deleted || Object.keys(body.nativeSources).length) {
    const loaded = sources ?? (await loadResourceDocuments(tx, owner, [resourceDocumentId(record.recordId)])).sources;
    const saved = loaded.get(resourceDocumentId(record.recordId));
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
  sources?: Sources,
) => {
  const { body, lifetime } = await legacyBody(tx, owner, record, sources);
  let value = body as unknown as Json;
  const texts: Record<string, OrderedTextState> = {};
  for (const [key, source] of Object.entries(body.nativeSources)) {
    if (!("field" in source)) continue;
    const loaded = sources ?? (await loadResourceDocuments(tx, owner, [nativeDocumentId(key)])).sources;
    const saved = loaded.get(nativeDocumentId(key));
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
    stamps: Object.fromEntries(
      await Promise.all(
        Object.entries(texts).map(async ([path, text]) => [
          path,
          JSON.stringify(["text", text.seed, await fingerprint(text.state)]),
        ]),
      ),
    ),
    ...(Object.keys(texts).length ? { texts } : {}),
  } satisfies OrderedRecord;
};

/** Share document reads across a bounded record page, including native field sources. */
export const convertLegacyOrderedRecords = async (
  tx: OrderedTransaction,
  owner: StorageOwner,
  records: NativeProjectedRecord[],
) => {
  const ids = records.flatMap((record) => [
    ...(record.deleted || Object.keys(record.nativeSources ?? {}).length ? [resourceDocumentId(record.recordId)] : []),
    ...Object.keys(record.nativeSources ?? {}).map(nativeDocumentId),
  ]);
  const sources: Sources = new Map();
  for (let offset = 0; offset < ids.length; offset += 100)
    for (const [id, source] of (await loadResourceDocuments(tx, owner, ids.slice(offset, offset + 100))).sources)
      sources.set(id, source);
  const converted = [];
  for (const record of records) converted.push(await convertLegacyOrderedRecord(tx, owner, record, sources));
  return converted;
};
