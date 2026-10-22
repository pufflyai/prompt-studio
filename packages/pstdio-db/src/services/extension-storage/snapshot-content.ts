import { gunzipSync, gzipSync } from "node:zlib";
import { and, eq } from "drizzle-orm";
import * as Y from "yjs";
import type { DbClient } from "../../db/connection.pglite";
import { document_snapshots, storage_document_updates, storage_documents } from "../../db/schemas.pg";

export type SnapshotTransaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];
export interface SnapshotDocument {
  extensionId: string;
  documentId: string;
  state: string;
}

export const captureSnapshotContent = async (tx: SnapshotTransaction, projectId: string) => {
  const documents = await tx
    .select()
    .from(storage_documents)
    .where(eq(storage_documents.workbench_id, projectId))
    .for("update");
  const updates = await tx
    .select()
    .from(storage_document_updates)
    .where(eq(storage_document_updates.workbench_id, projectId))
    .orderBy(storage_document_updates.revision);
  const key = (extensionId: string, documentId: string) => JSON.stringify([extensionId, documentId]);
  const byDocument = new Map<string, Uint8Array[]>();
  for (const update of updates) {
    const address = key(update.extension_id, update.document_id);
    const entries = byDocument.get(address) ?? [];
    entries.push(update.update);
    byDocument.set(address, entries);
  }
  const content: SnapshotDocument[] = documents.map((row) => ({
    extensionId: row.extension_id,
    documentId: row.document_id,
    state: Buffer.from(
      Y.mergeUpdates([row.state, ...(byDocument.get(key(row.extension_id, row.document_id)) ?? [])]),
    ).toString("base64"),
  }));
  return gzipSync(JSON.stringify(content));
};

export const readSnapshotContent = (state: Uint8Array) =>
  JSON.parse(gunzipSync(state).toString()) as SnapshotDocument[];

export const removeSnapshotOwner = async (tx: SnapshotTransaction, projectId: string, extensionId: string) => {
  const rows = await tx.select().from(document_snapshots).where(eq(document_snapshots.workbench_id, projectId));
  for (const row of rows) {
    const content = readSnapshotContent(row.state).filter((document) => document.extensionId !== extensionId);
    await tx
      .update(document_snapshots)
      .set({ state: gzipSync(JSON.stringify(content)) })
      .where(and(eq(document_snapshots.workbench_id, projectId), eq(document_snapshots.hours, row.hours)));
  }
};
