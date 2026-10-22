import { gunzipSync, gzipSync } from "node:zlib";
import { and, eq, inArray } from "drizzle-orm";
import * as Y from "yjs";
import type { DbClient } from "../../db/connection.pglite";
import {
  document_snapshots,
  extension_instances,
  installed_extension_sources,
  storage_document_updates,
  storage_documents,
} from "../../db/schemas.pg";

export type SnapshotTransaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];
export interface SnapshotDocument {
  extensionId: string;
  documentId: string;
  state: string;
}

export const isRecoveryDocument = (id: string) => {
  if (id === "records") return true;
  try {
    const value = JSON.parse(id);
    return Array.isArray(value) && value.length === 2 && value[0] === "text-file" && typeof value[1] === "string";
  } catch {
    return false;
  }
};

export const projectRecoveryDocuments = async (tx: Pick<DbClient, "select">, projectId: string, lock = false) => {
  // Retained uninstall data keeps its disabled instance and source. Internal/private owners have neither.
  const registered = await tx
    .select({ id: installed_extension_sources.extension_id })
    .from(extension_instances)
    .innerJoin(
      installed_extension_sources,
      eq(extension_instances.installed_extension_id, installed_extension_sources.id),
    )
    .where(and(eq(extension_instances.scope_type, "project"), eq(extension_instances.scope_id, projectId)));
  const owners = new Set(registered.map((row) => row.id));
  if (!owners.size) return { owners, documents: [] };
  const query = tx
    .select()
    .from(storage_documents)
    .where(and(eq(storage_documents.workbench_id, projectId), inArray(storage_documents.extension_id, [...owners])));
  const rows = lock ? await query.for("update") : await query;
  return { owners, documents: rows.filter((row) => isRecoveryDocument(row.document_id)) };
};

export const captureSnapshotContent = async (tx: SnapshotTransaction, projectId: string) => {
  const { documents } = await projectRecoveryDocuments(tx, projectId, true);
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
