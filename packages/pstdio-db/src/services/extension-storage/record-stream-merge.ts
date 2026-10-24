import { and, eq, like } from "drizzle-orm";
import { adoptResourceDocument, mergeResourceDocument, resourceDocumentState, type StorageOwner } from "pstdio-sync";
import type { RecordBytes } from "pstdio-sync/relay";
import type { DbClient } from "../../db/connection.pglite";
import { storage_documents } from "../../db/schemas.pg";
import type { RecordChange } from "./record-changes";
import { loadResourceDocuments, resourceDocumentId } from "./resource-document-persistence";
import { resourceFoldEvery } from "./resource-records";

type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];
const batchSize = 500;

const batches = <T>(items: T[]) =>
  Array.from({ length: Math.ceil(items.length / batchSize) }, (_, index) =>
    items.slice(index * batchSize, (index + 1) * batchSize),
  );

/** Record IDs of every record document this owner holds, deleted ones included. */
export const localRecordIds = async (tx: Pick<DbClient, "select">, owner: StorageOwner, limit?: number) => {
  const rows = await tx
    .select({ id: storage_documents.document_id })
    .from(storage_documents)
    .where(
      and(
        eq(storage_documents.workbench_id, owner.workbenchId),
        eq(storage_documents.extension_id, owner.extensionId),
        like(storage_documents.document_id, `${resourceDocumentId("").slice(0, -2)}%`),
      ),
    )
    .orderBy(storage_documents.document_id)
    .limit(limit ?? Number.MAX_SAFE_INTEGER);
  return rows.map((row) => (JSON.parse(row.id) as [string, string])[1]);
};

/** Full states of these records, for a latest state or for records the relay does not hold yet. */
export const recordStates = async (tx: Transaction, owner: StorageOwner, ids: string[]) => {
  const records: RecordBytes[] = [];
  for (const batch of batches(ids)) {
    const { sources } = await loadResourceDocuments(tx, owner, batch.map(resourceDocumentId));
    for (const recordId of batch) {
      const saved = sources.get(resourceDocumentId(recordId));
      if (saved) records.push({ recordId, bytes: resourceDocumentState(saved.states) });
    }
  }
  return records;
};

/** Merges incoming record bytes into local documents. Records whose bytes cannot be merged are skipped. */
export const mergeRecords = async (
  tx: Transaction,
  owner: StorageOwner,
  incoming: Map<string, Uint8Array[]>,
  repair: boolean,
) => {
  const changes: RecordChange[] = [];
  const missing: RecordBytes[] = [];
  const rejected: string[] = [];
  for (const batch of batches([...incoming.keys()])) {
    const { sources } = await loadResourceDocuments(tx, owner, batch.map(resourceDocumentId));
    for (const recordId of batch) {
      const id = resourceDocumentId(recordId);
      const saved = sources.get(id);
      const revision = (saved?.revision ?? 0) + 1;
      const foldedRevision = saved?.folded_revision ?? 0;
      try {
        const result = await mergeResourceDocument(recordId, saved?.states ?? [], incoming.get(recordId)!, {
          checkpoint: !saved || revision - foldedRevision >= resourceFoldEvery,
          repair,
        });
        if (result.update) changes.push({ id, revision, foldedRevision, ...result });
        if (result.missing) missing.push({ recordId, bytes: result.missing });
      } catch {
        rejected.push(recordId);
      }
    }
  }
  return { changes, missing, rejected };
};

/**
 * A device joining a stream another device started: each shared record takes the synced history,
 * with this device's changes reapplied as an edit to upload.
 */
export const adoptRecords = async (tx: Transaction, owner: StorageOwner, remote: Map<string, Uint8Array[]>) => {
  const changes: RecordChange[] = [];
  const uploads: RecordBytes[] = [];
  const rejected: string[] = [];
  for (const batch of batches([...remote.keys()])) {
    const { sources } = await loadResourceDocuments(tx, owner, batch.map(resourceDocumentId));
    for (const recordId of batch) {
      const id = resourceDocumentId(recordId);
      const saved = sources.get(id);
      try {
        if (!saved) {
          const result = await mergeResourceDocument(recordId, [], remote.get(recordId)!, { checkpoint: true });
          if (result.update) changes.push({ id, revision: 1, foldedRevision: 0, ...result });
          continue;
        }
        // The first checkpoint is the record as this device first saved it, until a fold replaces it.
        const base = saved.folded_revision === 1 ? saved.state : undefined;
        const result = await adoptResourceDocument(recordId, remote.get(recordId)!, saved.states, base);
        changes.push({
          id,
          revision: saved.revision + 1,
          foldedRevision: Math.max(saved.folded_revision, 1),
          checkpoint: result.state,
          update: result.state,
          record: result.record,
        });
        if (result.update) uploads.push({ recordId, bytes: result.update });
      } catch {
        rejected.push(recordId);
      }
    }
  }
  return { changes, uploads, rejected };
};
