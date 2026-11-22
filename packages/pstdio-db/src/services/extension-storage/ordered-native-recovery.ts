import { and, eq, gt, isNotNull, isNull, sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import { jsonPointer, type OrderedOperation, type OrderedRecord, orderedBody } from "pstdio-sync/records";
import { readTextDocumentSeed } from "pstdio-sync/text";
import { fingerprint } from "pstdio-sync-contracts";
import * as Y from "yjs";
import { documents } from "../../db/schemas/documents";
import {
  storage_ordered_records as canonical,
  storage_current_records as current,
  storage_ordered_operations as operations,
  storage_ordered_touches as touches,
} from "../../db/schemas.pg";
import { loadFileDocument } from "./document-file-persistence";
import { documentFilesFor } from "./document-files";
import { nativeDocumentId } from "./document-kind";
import { externalRoomId, insertNativeRoom } from "./native-document-files";
import {
  type OrderedFieldMarker,
  orderedFieldMarkerId,
  orderedRoomMarkerId,
  readOrderedMarker,
  roomGeneration,
  saveOrderedMarker,
} from "./ordered-native-metadata";
import { decodeOrderedJson, type OrderedTransaction, orderedOwnerWhere } from "./ordered-sql";

import { storageOwnerKey } from "./storage-owner-key";

const authoredId = (id: string) => JSON.stringify(["ordered-native-authored", id]);
type Captured = Record<string, { generation?: string; recordId: string; field: string; state?: string }>;
interface AuthoredText {
  projected: boolean;
  fields: Captured;
}

const fieldsFor = async (tx: OrderedTransaction, owner: StorageOwner, operation: OrderedOperation) => {
  const fields: { key: string; recordId: string; field: string; pointer: string }[] = [];
  for (const edit of operation.edits) {
    if (!edit.texts?.length) continue;
    const [row] = await tx
      .select({ sources: current.native_sources })
      .from(current)
      .where(and(orderedOwnerWhere(current, owner), eq(current.record_id, edit.recordId)));
    const bindings = { ...row?.sources };
    for (const change of edit.changes)
      if (
        change.path[0] === "nativeSources" &&
        change.path.length === 2 &&
        "set" in change &&
        change.set &&
        typeof change.set === "object" &&
        "field" in change.set
      )
        Object.defineProperty(bindings, change.path[1]!, { value: change.set, enumerable: true, configurable: true });
    for (const [key, source] of Object.entries(bindings)) {
      if (!("field" in source)) continue;
      const pointer = `/value${source.field}`;
      if (edit.texts.some((text) => jsonPointer(text.path) === pointer))
        fields.push({ key, recordId: edit.recordId, field: source.field, pointer });
    }
  }
  return fields;
};

/** Capture private replica lineage atomically with the authored immutable text envelope. */
export const rememberOrderedTextGeneration = async (
  tx: OrderedTransaction,
  owner: StorageOwner,
  operation: OrderedOperation,
  projected = true,
) => {
  const captured: Captured = {};
  for (const field of await fieldsFor(tx, owner, operation)) {
    const marker = await readOrderedMarker<OrderedFieldMarker>(tx, owner, orderedFieldMarkerId(field.key));
    captured[field.key] = { recordId: field.recordId, field: field.field, generation: marker?.value.generation };
  }
  if (operation.edits.some((edit) => edit.texts?.length))
    await saveOrderedMarker(tx, owner, authoredId(operation.operationId), {
      projected,
      fields: captured,
    } satisfies AuthoredText);
};
/** A first-join replacement can outlive its adopted text history. Retain its actual
 * projected source only while this synthetic save is pending, beside its lineage. */
export const rememberOrderedAdoptionText = async (
  tx: OrderedTransaction,
  owner: StorageOwner,
  operation: OrderedOperation,
  local: OrderedRecord,
  projected: OrderedRecord | undefined,
) => {
  const fields: Captured = {};
  for (const [key, source] of Object.entries(orderedBody(local).nativeSources)) {
    if (!("field" in source)) continue;
    const pointer = `/value${source.field}`;
    if (!operation.edits.some((edit) => edit.texts?.some((text) => jsonPointer(text.path) === pointer))) continue;
    const marker = await readOrderedMarker<OrderedFieldMarker>(tx, owner, orderedFieldMarkerId(key));
    fields[key] = {
      recordId: local.recordId,
      field: source.field,
      generation: marker?.value.generation,
      state: projected?.texts?.[pointer]?.state,
    };
  }
  if (Object.keys(fields).length)
    await saveOrderedMarker(tx, owner, authoredId(operation.operationId), {
      projected: !!projected,
      fields,
    } satisfies AuthoredText);
};

export const forgetOrderedTextGeneration = (tx: OrderedTransaction, owner: StorageOwner, id: string) =>
  tx.delete(documents).where(and(orderedOwnerWhere(documents, owner), eq(documents.key, authoredId(id))));

async function* pendingText(tx: OrderedTransaction, owner: StorageOwner, recordId: string) {
  let after = 0;
  while (true) {
    const rows = await tx
      .select({ envelope: operations.envelope, sequence: operations.local_sequence })
      .from(operations)
      .innerJoin(
        touches,
        and(eq(touches.owner_id, operations.owner_id), eq(touches.operation_id, operations.operation_id)),
      )
      .where(
        and(
          orderedOwnerWhere(operations, owner),
          eq(touches.record_id, recordId),
          isNotNull(operations.envelope),
          isNull(operations.settled_epoch),
          gt(operations.local_sequence, after),
        ),
      )
      .orderBy(operations.local_sequence)
      .limit(100);
    if (!rows.length) return;
    for (const row of rows) yield decodeOrderedJson<OrderedOperation>(row.envelope!);
    after = rows.at(-1)!.sequence;
  }
}

const mergePrivateRooms = async (
  tx: OrderedTransaction,
  owner: StorageOwner,
  field: { key: string },
  document: Y.Doc,
  generation?: string,
  seedId?: string,
) => {
  // Existing admitted rooms already preserve editor work that had not reached its source yet.
  const admitted = await tx
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.owner_id, storageOwnerKey(owner)),
        eq(documents.kind, "room"),
        sql`${documents.room_of} = (SELECT id FROM documents WHERE owner_id=${storageOwnerKey(owner)} AND key=${nativeDocumentId(field.key)})`,
      ),
    );
  for (const room of admitted) {
    if ((await roomGeneration(tx, owner, externalRoomId(room.key))) !== generation) continue;
    const { document: copy } = await loadFileDocument(documentFilesFor(tx), owner.workbenchId, room);
    try {
      const seed = await readTextDocumentSeed(copy);
      if (!seedId || seed.id === seedId) Y.applyUpdate(document, Y.encodeStateAsUpdate(copy));
    } finally {
      copy.destroy();
    }
  }
};

const mergePrivatePending = async (
  tx: OrderedTransaction,
  owner: StorageOwner,
  field: { key: string; recordId: string; pointer: string },
  document: Y.Doc,
  generation?: string,
  seed?: string,
) => {
  for await (const pending of pendingText(tx, owner, field.recordId))
    for (const edit of pending.edits) {
      if (edit.recordId !== field.recordId) continue;
      for (const text of edit.texts ?? []) {
        if (jsonPointer(text.path) !== field.pointer || (seed && text.seed !== seed)) continue;
        const captured = (await readOrderedMarker<AuthoredText>(tx, owner, authoredId(pending.operationId)))?.value
          .fields[field.key];
        if (captured?.generation !== generation) continue;
        Y.applyUpdate(document, Buffer.from(text.update, "base64"));
      }
    }
};

const privateFieldState = async (
  tx: OrderedTransaction,
  owner: StorageOwner,
  field: { key: string; recordId: string; pointer: string },
  generation?: string,
  before?: OrderedRecord,
  capturedState?: string,
) => {
  const [row] = await tx
    .select({ state: canonical.state })
    .from(canonical)
    .where(and(orderedOwnerWhere(canonical, owner), eq(canonical.record_id, field.recordId)));
  const record = before ?? (row ? decodeOrderedJson<OrderedRecord>(row.state) : undefined);
  const document = new Y.Doc();
  try {
    const saved = record?.texts?.[field.pointer];
    const state = capturedState ?? saved?.state;
    if (state) Y.applyUpdate(document, Buffer.from(state, "base64"));
    const seed = capturedState ? (await readTextDocumentSeed(document)).id : saved?.seed;
    await mergePrivateRooms(tx, owner, field, document, generation, seed);
    await mergePrivatePending(tx, owner, field, document, generation, capturedState ? seed : undefined);
    if (document.store.pendingStructs || document.store.pendingDs)
      throw new Error("Private text recovery is missing authored causal history");
    await readTextDocumentSeed(document);
    return Y.encodeStateAsUpdate(document);
  } finally {
    document.destroy();
  }
};

/** Called BEFORE settling a refused local group or removing its pending membership. */
export const fenceOrderedNativeText = async (
  tx: OrderedTransaction,
  owner: StorageOwner,
  operation: OrderedOperation,
  before?: OrderedRecord,
) => {
  const authored = (await readOrderedMarker<AuthoredText>(tx, owner, authoredId(operation.operationId)))?.value;
  if (authored?.projected === false) return;
  const captured = authored?.fields ?? {};
  const fields = before
    ? Object.entries(orderedBody(before).nativeSources).flatMap(([key, source]) =>
        "field" in source &&
        operation.edits.some((edit) => edit.texts?.some((text) => jsonPointer(text.path) === `/value${source.field}`))
          ? [{ key, recordId: before.recordId, field: source.field, pointer: `/value${source.field}` }]
          : [],
      )
    : [
        ...new Map(
          [
            ...(await fieldsFor(tx, owner, operation)),
            ...Object.entries(captured).map(([key, value]) => ({
              key,
              recordId: value.recordId,
              field: value.field,
              pointer: `/value${value.field}`,
            })),
          ].map((field) => [field.key, field]),
        ).values(),
      ];
  for (const field of fields) {
    const marker = await readOrderedMarker<OrderedFieldMarker>(tx, owner, orderedFieldMarkerId(field.key));
    if (!marker) continue;
    const generation = before ? marker.value.generation : captured[field.key]?.generation;
    const capturedState = captured[field.key]?.state;
    const current = marker.value.generation === generation;
    if (!current && !capturedState) continue;
    const state = await privateFieldState(tx, owner, field, generation, before, capturedState);
    const id = crypto.randomUUID();
    await insertNativeRoom(tx, { owner, documentKey: field.key, id, state });
    if (generation !== undefined) await saveOrderedMarker(tx, owner, orderedRoomMarkerId(id), { generation });
    if (!current) continue; // Preserve the old private lineage without fencing a fresh replica.
    const next = await fingerprint({
      owner: [owner.workbenchId, owner.extensionId],
      key: field.key,
      refused: operation.operationId,
      fingerprint: operation.fingerprint,
    });
    await saveOrderedMarker(tx, owner, orderedFieldMarkerId(field.key), { ...marker.value, generation: next });
  }
};
