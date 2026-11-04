import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { createNativeSourceKey } from "pstdio-api-contracts";
import {
  NativeSourcePendingError,
  NativeSourceRetiredError,
  type StorageObserver,
  type StorageOwner,
  StorageRevisionChangedError,
} from "pstdio-sync";
import {
  jsonPointer,
  type NativeRecordSources,
  nativeAssetBindingBaseline,
  nativeFieldValue,
  observeOrderedRecord,
  orderedTextLifetime,
  parseJsonPointer,
  prepareOrderedOperation,
  prepareOrderedText,
} from "pstdio-sync/records";
import { importTextSource } from "pstdio-sync/text";
import { fingerprint, type Json } from "pstdio-sync-contracts";
import {
  storage_current_records as current,
  storage_documents as documents,
  storage_ordered_owners as owners,
} from "../../db/schemas.pg";
import { registerSharedDocument } from "./document-directory";
import { runDocumentTransaction } from "./document-persistence";
import { nativeDocumentId, readNativeTextIn } from "./native-record-projection";
import type { OrderedJournal } from "./ordered-journal";
import { type OrderedFieldMarker, orderedFieldMarkerId, readOrderedMarker } from "./ordered-native-metadata";
import { rememberOrderedTextGeneration } from "./ordered-native-recovery";
import { orderedBody } from "./ordered-projection";
import { rebaseOrderedProjection } from "./ordered-rebase";
import { encodeOrderedJson, type OrderedTransaction, orderedOwnerWhere } from "./ordered-sql";
import { readProjectedRecords } from "./record-queries";

export interface OrderedSourceInput {
  recordId: string;
  documentKey: string;
  sourceKey?: string;
  field?: string;
  content?: string;
}

const validateExistingSource = async (
  tx: OrderedTransaction,
  owner: StorageOwner,
  input: OrderedSourceInput,
  key: string,
  value: Json,
) => {
  if (input.content === undefined) return;
  const current = input.field ? nativeFieldValue(value, input.field) : await readNativeTextIn(tx, owner, key);
  if (current === undefined) throw new NativeSourcePendingError();
  if (input.content !== current) throw new Error("A native file view must load its full source bytes");
};

export const findOrderedNativeField = async (
  tx: Pick<OrderedTransaction, "select">,
  owner: StorageOwner,
  key: string,
) => {
  const [row] = await tx
    .select({
      recordId: current.record_id,
      lifetime: current.record_lifetime,
      sources: current.native_sources,
      deleted: current.deleted,
    })
    .from(current)
    .innerJoin(
      owners,
      and(eq(owners.workbench_id, current.workbench_id), eq(owners.extension_id, current.extension_id)),
    )
    .where(and(orderedOwnerWhere(current, owner), sql`${current.native_sources} ? ${key}`))
    .limit(1);
  const source = row?.sources[key];
  if (row && !row.deleted && source && "field" in source)
    return {
      recordId: row.recordId,
      field: source.field,
      lifetime: row.lifetime,
      source,
      generation: (await readOrderedMarker<OrderedFieldMarker>(tx, owner, orderedFieldMarkerId(key)))?.value.generation,
    };
  const [marker] = await tx
    .select({ id: documents.document_id })
    .from(documents)
    .where(and(orderedOwnerWhere(documents, owner), eq(documents.document_id, orderedFieldMarkerId(key))));
  if (marker) throw new NativeSourceRetiredError(row?.recordId);
  return undefined;
};

const sourceAddress = (sources: NativeRecordSources, key: string, lifetime: string) => {
  if (Object.hasOwn(sources, key) || lifetime === "initial") return key;
  const occurrence = JSON.parse(lifetime) as string[];
  // A pending recreation and its accepted occurrence name the same authored lifetime.
  const authored = occurrence[0] === "pending" ? occurrence[1]! : occurrence[2]!;
  return createNativeSourceKey([key, authored]);
};

const bindNativeAsset = async (
  tx: OrderedTransaction,
  owner: StorageOwner,
  key: string,
  value: string,
  asset: ReturnType<typeof orderedBody>["asset"],
  lifetime: string,
) => {
  if (!asset) throw new Error("A native file source needs its original asset bytes");
  const bytes = new TextEncoder().encode(value);
  if (bytes.length !== asset.byteLength || createHash("sha256").update(bytes).digest("hex") !== asset.sha256)
    throw new Error("A native file view must load its full source bytes");
  const native = await runDocumentTransaction(
    tx,
    {
      owner,
      address: {
        workbench_id: owner.workbenchId,
        extension_id: owner.extensionId,
        document_id: nativeDocumentId(key),
      },
    },
    async ({ document }) => importTextSource(document, key, value),
  );
  await registerSharedDocument(tx, owner, nativeDocumentId(key));
  try {
    return {
      asset: asset,
      baseline: Buffer.from(await nativeAssetBindingBaseline(native.document, value)).toString("base64"),
      lifetime: lifetime,
    };
  } finally {
    native.document.destroy();
  }
};

const observeBindingWrite = (
  observer: StorageObserver | undefined,
  owner: StorageOwner,
  saved: Awaited<ReturnType<typeof rebaseOrderedProjection>>,
  recordId: string,
  operationId: string,
) => {
  if (saved.suppressed.has(operationId)) return;
  const written = saved.records.filter((row) => row.recordId === recordId);
  if (written.length) observer?.committed(owner, written, { status: "saved-locally" });
};

export const bindOrderedNativeSource = async (
  journal: OrderedJournal,
  tx: OrderedTransaction,
  owner: StorageOwner,
  input: OrderedSourceInput,
  observer?: StorageObserver,
) => {
  const { views } = await rebaseOrderedProjection(journal, tx, owner, [input.recordId]);
  const record = views.get(input.recordId);
  if (!record || record.deleted) throw new NativeSourceRetiredError(input.recordId);
  const expected = observer?.expected?.(owner, input.recordId);
  if (expected !== undefined && expected !== (await readProjectedRecords(tx, owner, [input.recordId]))[0]!.revision)
    throw new StorageRevisionChangedError();
  const body = orderedBody(record);
  const sources = body.nativeSources;
  const key = sourceAddress(sources, input.sourceKey ?? input.documentKey, record.lifetime);
  if (input.sourceKey && key !== input.documentKey) throw new StorageRevisionChangedError();
  const existing = Object.entries(sources).find(([, source]) =>
    input.field ? "field" in source && source.field === input.field : "asset" in source,
  );
  if (existing) {
    if (existing[0] !== key) throw new Error("The source already belongs to another text document");
    await validateExistingSource(tx, owner, input, key, body.value);
    return {
      changed: false,
      recordId: record.recordId,
      documentKey: key,
      lifetime: record.lifetime,
      records: [],
      projected: 0,
    };
  }
  const value = input.field ? nativeFieldValue(body.value, input.field) : input.content;
  if (typeof value !== "string") throw new Error("A native text source must contain its full source bytes");
  if (input.content !== undefined && input.content !== value)
    throw new Error("A native file view must load its full source bytes");
  const texts = [];
  let source: NativeRecordSources[string];
  if (input.field) {
    const path = ["value", ...parseJsonPointer(input.field)];
    texts.push(
      await prepareOrderedText({
        recordId: record.recordId,
        lifetime: orderedTextLifetime(record, path),
        path,
        value: record.value,
        saved: record.texts?.[jsonPointer(path)],
        edit: (document) => importTextSource(document, key, value),
      }),
    );
    source = { field: input.field, original: value, lifetime: record.lifetime };
    await tx
      .insert(documents)
      .values({
        workbench_id: owner.workbenchId,
        extension_id: owner.extensionId,
        document_id: orderedFieldMarkerId(key),
        state: encodeOrderedJson({ recordId: record.recordId, field: input.field, lifetime: record.lifetime }),
      })
      .onConflictDoNothing();
  } else source = await bindNativeAsset(tx, owner, key, value, body.asset, record.lifetime);
  const operationId = crypto.randomUUID();
  const requiresOriginalSource =
    !input.field || !record.texts?.[jsonPointer(["value", ...parseJsonPointer(input.field)])];
  const operation = await prepareOrderedOperation(
    {
      operationId,
      edits: [
        {
          recordId: record.recordId,
          changes: [
            { path: ["nativeSources", key], set: source as unknown as Json },
            ...(!input.field ? [{ path: ["asset"], set: body.asset as unknown as Json }] : []),
          ],
          texts,
          ...(requiresOriginalSource ? { expectedRevision: await observeOrderedRecord(record) } : {}),
        },
      ],
    },
    views,
  );
  await rememberOrderedTextGeneration(tx, owner, operation);
  await journal.queue(operation, await fingerprint({ bind: input as unknown as Json }));
  const saved = await rebaseOrderedProjection(journal, tx, owner, [record.recordId]);
  observeBindingWrite(observer, owner, saved, record.recordId, operationId);
  return { ...saved, changed: true, recordId: record.recordId, documentKey: key, lifetime: record.lifetime };
};

/** Resolve the ordered lifetime without loading a retired per-record Yjs document. */
export const orderedNativeAddress = async (
  tx: Pick<OrderedTransaction, "select">,
  owner: StorageOwner,
  input: { recordId: string; documentKey: string },
) => {
  const [row] = await tx
    .select({ deleted: current.deleted, lifetime: current.record_lifetime, sources: current.native_sources })
    .from(current)
    .where(and(orderedOwnerWhere(current, owner), eq(current.record_id, input.recordId)));
  if (!row || row.deleted) throw new NativeSourceRetiredError(input.recordId);
  const key = sourceAddress(row.sources, input.documentKey, row.lifetime);
  const marker = await readOrderedMarker<OrderedFieldMarker>(tx, owner, orderedFieldMarkerId(key));
  return { documentKey: key, lifetime: row.lifetime, generation: marker?.value.generation };
};
