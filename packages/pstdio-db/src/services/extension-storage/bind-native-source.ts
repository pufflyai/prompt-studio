import { createHash } from "node:crypto";
import { and, eq, max } from "drizzle-orm";
import {
  importTextSource,
  type NativeRecordSources,
  NativeSourcePendingError,
  nativeAssetBindingBaseline,
  nativeFieldValue,
  recordTextBindingUpdate,
  type StorageObserver,
  type StorageOwner,
  StorageRevisionChangedError,
} from "pstdio-sync";
import type { DbClient } from "../../db/connection.pglite";
import { storage_document_updates, storage_documents } from "../../db/schemas.pg";
import { runDocumentTransaction } from "./document-persistence";
import { nativeDocumentId } from "./native-record-projection";
import { lockRecordOwner, saveRecordChanges } from "./record-changes";
import { queueRecordUpload } from "./record-outbox";
import { readProjectedRecords } from "./record-queries";
import { resourceDocumentId } from "./resource-document-persistence";

type SourceInput = { recordId: string; documentKey: string; field?: string; content?: string };
const initialSource = (record: Awaited<ReturnType<typeof readProjectedRecords>>[number], input: SourceInput) => {
  if (input.field) {
    const value = nativeFieldValue(record.value, input.field);
    if (typeof value !== "string") throw new Error("A native text field must contain a string");
    if (input.content !== undefined && input.content !== value)
      throw new Error("A native file view must load its full source bytes");
    return { source: { field: input.field, original: value }, content: value };
  }
  if (!record.asset || input.content === undefined)
    throw new Error("A native file source needs its original asset bytes");
  const bytes = new TextEncoder().encode(input.content);
  if (
    bytes.byteLength !== record.asset.byteLength ||
    createHash("sha256").update(bytes).digest("hex") !== record.asset.sha256
  )
    throw new Error("A native file view must load its full source bytes");
  return { source: { asset: record.asset }, content: input.content };
};
const sameSource = (source: NativeRecordSources[string], field?: string) =>
  field ? "field" in source && source.field === field : "asset" in source;
const sourceLifetime = (record: Awaited<ReturnType<typeof readProjectedRecords>>[number]) => {
  if (!record.exists || record.deleted) throw new Error("The text source no longer exists");
  if (!("recordLifetime" in record) || !record.recordLifetime) throw new NativeSourcePendingError();
  return record.recordLifetime;
};

/** Attach a source with a metadata-only CRDT delta; editor opening never loads a record document. */
export const bindNativeRecordSource = async (
  db: DbClient,
  owner: StorageOwner,
  input: SourceInput,
  observer?: StorageObserver,
) =>
  db.transaction(async (tx) => {
    const revision = await lockRecordOwner(tx, owner);
    const [record] = await readProjectedRecords(tx, owner, [input.recordId]);
    const lifetime = sourceLifetime(record);
    const sources = ("nativeSources" in record ? record.nativeSources : {}) ?? {};
    const existing = Object.entries(sources).find(([, source]) => sameSource(source, input.field));
    if (existing) {
      if (existing[0] !== input.documentKey) throw new Error("The source already belongs to another text document");
      return { changed: false, record };
    }
    const expected = observer?.expected?.(owner, input.recordId);
    if (expected !== undefined && expected !== record.revision) throw new StorageRevisionChangedError();
    const original = initialSource(record, input);
    const { content } = original;
    const native = await runDocumentTransaction(
      tx,
      {
        owner,
        address: {
          workbench_id: owner.workbenchId,
          extension_id: owner.extensionId,
          document_id: nativeDocumentId(input.documentKey),
        },
      },
      async ({ document }) => importTextSource(document, input.documentKey, content),
    );
    const body =
      "asset" in original.source
        ? {
            ...original.source,
            baseline: Buffer.from(await nativeAssetBindingBaseline(native.document, content)).toString("base64"),
          }
        : original.source;
    const source = { ...body, lifetime };
    native.document.destroy();
    const id = resourceDocumentId(input.recordId);
    const scope = (table: typeof storage_documents | typeof storage_document_updates) =>
      and(
        eq(table.workbench_id, owner.workbenchId),
        eq(table.extension_id, owner.extensionId),
        eq(table.document_id, id),
      );
    const [head] = await tx
      .select({ revision: storage_documents.revision, folded: storage_documents.folded_revision })
      .from(storage_documents)
      .where(scope(storage_documents));
    if (!head) throw new Error("The source record needs its storage upgrade before binding");
    const [tail] = await tx
      .select({ revision: max(storage_document_updates.revision) })
      .from(storage_document_updates)
      .where(scope(storage_document_updates));
    const update = recordTextBindingUpdate(input.recordId, input.documentKey, source);
    const prepared = {
      id,
      revision: Math.max(head.revision, tail?.revision ?? 0) + 1,
      foldedRevision: head.folded,
      checkpoint: null,
      update,
      record: { ...record, nativeSources: { ...sources, [input.documentKey]: source } },
    };
    await saveRecordChanges(tx, owner, revision, [prepared]);
    await queueRecordUpload(tx, owner, [prepared]);
    const [saved] = await readProjectedRecords(tx, owner, [input.recordId]);
    return { changed: true, record: saved };
  });
