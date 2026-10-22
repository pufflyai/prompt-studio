import { and, eq } from "drizzle-orm";
import {
  applyDocumentBinaryUpdate,
  type DocumentState,
  documentHistory,
  resourceNumbersDocumentId,
  resourceNumbersOwnerId,
  type StorageOwner,
  trackDocumentBinary,
  trackDocumentPayload,
} from "pstdio-sync";
import * as Y from "yjs";
import type { DbClient } from "../../db/connection.pglite";
import { storage_document_operations, storage_document_updates, storage_documents } from "../../db/schemas.pg";
import { dataMigrationContext } from "./data-migration-context";
import type { LoadedDocument } from "./document-cache";
import { importOwnerDocument } from "./document-import";
import { trackRecordProjection } from "./record-projection";
import { trackResourceIdentityProjection } from "./resource-identity-projection";
import type { StorageDiagnostics } from "./storage-diagnostics";

type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];
export interface DocumentAddress {
  workbench_id: string;
  extension_id: string;
  document_id: string;
}
export const documentWhere = (address: DocumentAddress) =>
  and(
    eq(storage_documents.workbench_id, address.workbench_id),
    eq(storage_documents.extension_id, address.extension_id),
    eq(storage_documents.document_id, address.document_id),
  );
export const updatesWhere = (address: DocumentAddress) =>
  and(
    eq(storage_document_updates.workbench_id, address.workbench_id),
    eq(storage_document_updates.extension_id, address.extension_id),
    eq(storage_document_updates.document_id, address.document_id),
  );
export const foldEvery = 128;

const readDocument = async (tx: Transaction, address: DocumentAddress, owner: StorageOwner, environmentId: string) => {
  const inserted = await tx
    .insert(storage_documents)
    .values({ ...address, state: new Uint8Array([0, 0]) })
    .onConflictDoNothing()
    .returning();
  const [row] = await tx
    .select({ revision: storage_documents.revision, folded_revision: storage_documents.folded_revision })
    .from(storage_documents)
    .where(documentWhere(address))
    .for("update");
  const [saved] = await tx
    .select({ state: storage_documents.state })
    .from(storage_documents)
    .where(documentWhere(address));
  if (inserted.length && address.document_id === "records") {
    saved.state = await importOwnerDocument(tx, owner, environmentId);
    await tx.update(storage_documents).set({ state: saved.state }).where(documentWhere(address));
  }
  const updates = await tx
    .select()
    .from(storage_document_updates)
    .where(updatesWhere(address))
    .orderBy(storage_document_updates.revision);
  return { row, updates: [saved.state, ...updates.map(({ update }) => update)] };
};

export const prepareDocument = async (
  db: DbClient,
  input: { address: DocumentAddress; owner: StorageOwner; environmentId: string; diagnostics?: StorageDiagnostics },
) => {
  const { row, updates } = await db.transaction((tx) =>
    readDocument(tx, input.address, input.owner, input.environmentId),
  );
  const report = (phase: "document-captured" | "document-hydrated" | "document-loaded") =>
    input.diagnostics?.({
      phase,
      owner: input.owner,
      documentId: input.address.document_id,
      sourceRevision: row.revision,
      bytes: updates.reduce((sum, update) => sum + update.length, 0),
    });
  report("document-captured");
  const document = new Y.Doc();
  try {
    for (const update of updates) Y.applyUpdate(document, update);
    trackDocumentBinary(document, updates);
    report("document-hydrated");
    if (input.address.document_id === "records") trackDocumentPayload(document);
    report("document-loaded");
    return { revision: row.revision, document };
  } catch (error) {
    document.destroy();
    throw error;
  }
};

export class DocumentPreparationChanged extends Error {}

const localOperations = (tx: Transaction, address: DocumentAddress) => {
  const pending = new Map<string, string>();
  return {
    operation: async (id: string) => {
      if (pending.has(id)) return pending.get(id);
      const [row] = await tx
        .select({ fingerprint: storage_document_operations.fingerprint })
        .from(storage_document_operations)
        .where(
          and(
            eq(storage_document_operations.workbench_id, address.workbench_id),
            eq(storage_document_operations.extension_id, address.extension_id),
            eq(storage_document_operations.document_id, address.document_id),
            eq(storage_document_operations.operation_id, id),
          ),
        );
      return row?.fingerprint;
    },
    remember: (id: string, fingerprint: string) => {
      pending.set(id, fingerprint);
    },
    async persist() {
      if (!pending.size) return;
      await tx
        .insert(storage_document_operations)
        .values([...pending].map(([id, fingerprint]) => ({ ...address, operation_id: id, fingerprint })))
        .onConflictDoNothing();
    },
  };
};

const appendUpdates = async (
  tx: Transaction,
  address: DocumentAddress,
  row: Pick<typeof storage_documents.$inferSelect, "revision" | "folded_revision">,
  updates: Uint8Array[],
) => {
  if (!updates.length) return row.revision;
  const revision = row.revision + 1;
  await tx.insert(storage_document_updates).values({ ...address, revision, update: Y.mergeUpdates(updates) });
  await tx.update(storage_documents).set({ revision }).where(documentWhere(address));
  return revision;
};

export const runDocumentTransaction = async <T>(
  tx: Transaction,
  input: {
    address: DocumentAddress;
    owner: StorageOwner;
    diagnostics?: StorageDiagnostics;
    prepared: LoadedDocument;
  },
  action: (state: DocumentState) => Promise<T>,
) => {
  const { address } = input;
  const [row] = await tx
    .select({ revision: storage_documents.revision, folded_revision: storage_documents.folded_revision })
    .from(storage_documents)
    .where(documentWhere(address))
    .for("update");
  if (!row || row.revision !== input.prepared.revision) throw new DocumentPreparationChanged();
  const { document } = input.prepared;
  const projection =
    address.document_id === "records"
      ? await trackRecordProjection(tx, address, document, row.revision === 0, row.revision)
      : undefined;
  const identities =
    address.document_id === resourceNumbersDocumentId && address.extension_id === resourceNumbersOwnerId
      ? await trackResourceIdentityProjection(tx, address, document, row.revision === 0)
      : undefined;
  const operations = localOperations(tx, address);
  const key = JSON.stringify(address);
  const migration = dataMigrationContext.getStore();
  if (migration && !migration.histories.has(key)) migration.histories.set(key, documentHistory(document));
  const updates: Uint8Array[] = [];
  const capture = (update: Uint8Array) => updates.push(update);
  document.on("update", capture);
  const payload = address.document_id === "records" ? trackDocumentPayload(document) : undefined;
  try {
    const value = await action({
      document,
      revision: row.revision,
      applyUpdate: (update) => {
        // An accepted update can be buffered by Yjs without emitting an update event.
        updates.push(update);
        applyDocumentBinaryUpdate(document, update);
      },
      migrationSeed: migration?.key,
      migrationHistory: migration?.histories.get(key),
      operation: operations.operation,
      remember: operations.remember,
      rebuildProjection: projection
        ? async () => {
            payload?.upgrade();
            await projection.rebuild();
          }
        : identities?.rebuild,
    });
    identities?.prepare();
    await operations.persist();
    const revision = await appendUpdates(tx, address, row, updates);
    const projected = await projection?.persist(revision);
    await identities?.persist(revision);
    if (projected !== undefined)
      input.diagnostics?.({
        phase: "records-projected",
        owner: input.owner,
        documentId: address.document_id,
        sourceRevision: revision,
        records: projected,
      });
    return { value, revision, document, changed: updates.length > 0, foldedRevision: row.folded_revision };
  } finally {
    document.off("update", capture);
    projection?.stop();
    identities?.stop();
  }
};
