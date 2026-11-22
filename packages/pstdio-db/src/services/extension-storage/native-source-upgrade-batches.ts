import { and, eq, inArray, sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import type { DbClient } from "../../db/connection.pglite";
import { storage_documents as documents, storage_document_updates as updates } from "../../db/schemas.pg";
import { loadResourceDocuments } from "./resource-document-persistence";
import { storageOwnerKey } from "./storage-owner-key";

type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];
const sourceBytes = 4_000_000;
/** Read sizes before history bytes, allowing one larger source to travel alone. */
export async function* nativeSourceUpgradeBatches(tx: Transaction, owner: StorageOwner, ids: string[]) {
  const rows = await tx
    .select({
      id: documents.document_id,
      bytes: sql<number>`octet_length(${documents.state}) + coalesce((
    SELECT sum(octet_length(${updates.update})) FROM ${updates}
    WHERE ${updates.owner_id} = ${documents.owner_id} AND ${updates.document_id} = ${documents.document_id}
  ), 0)`,
    })
    .from(documents)
    .where(and(eq(documents.owner_id, storageOwnerKey(owner)), inArray(documents.document_id, ids)));
  const sizes = new Map(rows.map((row) => [row.id, Number(row.bytes)]));
  let pending: string[] = [];
  let bytes = 0;
  for (const id of ids) {
    const size = sizes.get(id) ?? 0;
    if (pending.length && bytes + size > sourceBytes) {
      yield { ...(await loadResourceDocuments(tx, owner, pending)), ids: pending };
      pending = [];
      bytes = 0;
    }
    pending.push(id);
    bytes += size;
  }
  if (pending.length) yield { ...(await loadResourceDocuments(tx, owner, pending)), ids: pending };
}
