import { and, eq } from "drizzle-orm";
import { type DocumentState, documentHistory, type StorageOwner } from "pstdio-sync";
import * as Y from "yjs";
import type { DbClient } from "../../db/connection.pglite";
import { storage_document_operations, storage_document_updates, storage_documents } from "../../db/schemas.pg";
import { dataMigrationContext } from "./data-migration-context";
import type { LoadedDocument } from "./document-cache";
import { importOwnerDocument } from "./document-import";

type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];
export interface DocumentAddress {
  workbench_id: string;
  extension_id: string;
  document_id: string;
}
const documentWhere = (address: DocumentAddress) =>
  and(
    eq(storage_documents.workbench_id, address.workbench_id),
    eq(storage_documents.extension_id, address.extension_id),
    eq(storage_documents.document_id, address.document_id),
  );
const updatesWhere = (address: DocumentAddress) =>
  and(
    eq(storage_document_updates.workbench_id, address.workbench_id),
    eq(storage_document_updates.extension_id, address.extension_id),
    eq(storage_document_updates.document_id, address.document_id),
  );
const foldEvery = 128;

const loadDocument = async (
  tx: Transaction,
  address: DocumentAddress,
  owner: StorageOwner,
  environmentId: string,
  cached?: LoadedDocument,
) => {
  const inserted = await tx
    .insert(storage_documents)
    .values({ ...address, state: new Uint8Array([0, 0]) })
    .onConflictDoNothing()
    .returning();
  const [row] = await tx.select().from(storage_documents).where(documentWhere(address)).for("update");
  if (inserted.length && address.document_id === "records") {
    row.state = await importOwnerDocument(tx, owner, environmentId);
    await tx.update(storage_documents).set({ state: row.state }).where(documentWhere(address));
  }
  if (cached?.revision === row.revision) return { row, document: cached.document };
  const document = new Y.Doc();
  Y.applyUpdate(document, row.state);
  const updates = await tx
    .select()
    .from(storage_document_updates)
    .where(updatesWhere(address))
    .orderBy(storage_document_updates.revision);
  for (const update of updates) Y.applyUpdate(document, update.update);
  return { row, document };
};

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
  row: typeof storage_documents.$inferSelect,
  document: Y.Doc,
  updates: Uint8Array[],
) => {
  if (!updates.length) return row.revision;
  const revision = row.revision + 1;
  await tx.insert(storage_document_updates).values({ ...address, revision, update: Y.mergeUpdates(updates) });
  const fold = revision - row.folded_revision >= foldEvery;
  await tx
    .update(storage_documents)
    .set({ revision, ...(fold && { state: Y.encodeStateAsUpdate(document), folded_revision: revision }) })
    .where(documentWhere(address));
  if (fold) await tx.delete(storage_document_updates).where(updatesWhere(address));
  return revision;
};

export const runDocumentTransaction = async <T>(
  tx: Transaction,
  input: {
    address: DocumentAddress;
    owner: StorageOwner;
    environmentId: string;
    cached?: LoadedDocument;
  },
  action: (state: DocumentState) => Promise<T>,
) => {
  const { address } = input;
  const { document, row } = await loadDocument(tx, address, input.owner, input.environmentId, input.cached);
  const operations = localOperations(tx, address);
  const key = JSON.stringify(address);
  const migration = dataMigrationContext.getStore();
  if (migration && !migration.histories.has(key)) migration.histories.set(key, documentHistory(document));
  const updates: Uint8Array[] = [];
  const capture = (update: Uint8Array) => updates.push(update);
  document.on("update", capture);
  try {
    const value = await action({
      document,
      migrationSeed: migration?.key,
      migrationHistory: migration?.histories.get(key),
      operation: operations.operation,
      remember: operations.remember,
    });
    await operations.persist();
    const revision = await appendUpdates(tx, address, row, document, updates);
    return { value, revision, document, changed: updates.length > 0 };
  } catch (error) {
    if (document !== input.cached?.document) document.destroy();
    throw error;
  } finally {
    document.off("update", capture);
  }
};
