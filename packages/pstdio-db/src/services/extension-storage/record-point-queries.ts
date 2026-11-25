import { and, eq, inArray, sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import type { NativeRecordSources } from "pstdio-sync/records";
import { fingerprint, type StorageRecord } from "pstdio-sync-contracts";
import type { DbClient } from "../../db/connection.pglite";
import { records as current } from "../../db/schemas.pg";
import { withDocumentFileTransaction } from "./document-files";
import type { NativeProjectedRecord } from "./native-record-projection";
import { decodeProjectionValue } from "./record-projection-codec";
import { hasRetainedRecords, readRetainedRecord } from "./retained-records";
import { storageOwnerKey } from "./storage-owner-key";

// Public materialization never hydrates confirmed pending bases or private canonical metadata.
const projectedColumns = {
  record_id: current.record_id,
  deleted: current.deleted,
  value: current.value,
  asset: current.asset,
  shared: current.shared,
  native_sources: current.native_sources,
  native_versions: current.native_versions,
  record_lifetime: current.record_lifetime,
  revision: current.revision,
};
type Current = Pick<typeof current.$inferSelect, keyof typeof projectedColumns>;
const missingRecord = async (recordId: string) => ({
  recordId,
  exists: false,
  deleted: false,
  value: null,
  asset: null,
  shared: null,
  revision: await fingerprint({ value: null, asset: null, shared: null, deleted: false }),
});
const asRecord = (row: Current): NativeProjectedRecord => {
  if (row.revision === null) throw new Error("An unpublished record cannot be read as a projection");
  const sources = row.deleted
    ? {}
    : (decodeProjectionValue(row.native_sources as never) as unknown as NativeRecordSources);
  return {
    recordId: row.record_id,
    exists: true,
    deleted: row.deleted,
    value: row.deleted ? null : decodeProjectionValue(row.value ?? null),
    asset: row.deleted ? null : (decodeProjectionValue(row.asset) as StorageRecord["asset"]),
    shared: row.deleted ? null : (decodeProjectionValue(row.shared) as StorageRecord["shared"]),
    revision: row.revision,
    ...(row.record_lifetime ? { recordLifetime: row.record_lifetime } : {}),
    ...(Object.keys(sources).length ? { nativeSources: sources, nativeVersions: row.native_versions } : {}),
  };
};

type Reader = Pick<DbClient, "select">;
export const currentWhere = (owner: StorageOwner) =>
  and(eq(current.owner_id, storageOwnerKey(owner)), sql`${current.revision} IS NOT NULL`);

const readMissingProjections = async (connection: Reader, owner: StorageOwner, ids: string[]) => {
  const found = new Map<string, NativeProjectedRecord>();
  if (!ids.length) return found;
  await withDocumentFileTransaction(connection, async (tx) => {
    // A restore can publish a SQL row and remove the cold entry after the root SELECT.
    // Recheck both authorities in this transaction before interpreting an ID as absent.
    if (tx !== connection) {
      const rows = await tx
        .select(projectedColumns)
        .from(current)
        .where(and(currentWhere(owner), inArray(current.record_id, ids)));
      for (const row of rows) found.set(row.record_id, asRecord(row));
    }
    const missing = ids.filter((id) => !found.has(id));
    if (!missing.length || !(await hasRetainedRecords(tx, owner))) return;
    for (const id of missing) {
      const saved = await readRetainedRecord(tx, owner, id);
      if (saved)
        found.set(id, {
          recordId: id,
          exists: true,
          deleted: true,
          value: null,
          asset: null,
          shared: null,
          revision: saved.revision,
          recordLifetime: saved.record.lifetime,
        });
    }
  });
  return found;
};

/** Cold deleted observations retain their exact revision after the SQL row is purged. */
export const readProjectedRecords = async (connection: Reader, owner: StorageOwner, ids: string[]) => {
  if (!ids.length) return [];
  const rows = await connection
    .select(projectedColumns)
    .from(current)
    .where(and(currentWhere(owner), inArray(current.record_id, ids)));
  const byId = new Map(rows.map((row) => [row.record_id, asRecord(row)]));
  const retained = await readMissingProjections(
    connection,
    owner,
    ids.filter((id) => !byId.has(id)),
  );
  return Promise.all(ids.map((id) => byId.get(id) ?? retained.get(id) ?? missingRecord(id)));
};

/** Conditional saves compare state under the owner lock without loading projected bodies. */
export const readProjectedRevisions = async (connection: Reader, owner: StorageOwner, ids: string[]) => {
  if (!ids.length) return [];
  const rows = await connection
    .select({ recordId: current.record_id, deleted: current.deleted, revision: current.revision })
    .from(current)
    .where(and(currentWhere(owner), inArray(current.record_id, ids)));
  const byId = new Map(rows.map((row) => [row.recordId, row]));
  const retained = await readMissingProjections(
    connection,
    owner,
    ids.filter((id) => !byId.has(id)),
  );
  return ids.map((id) => {
    const row = byId.get(id) ?? retained.get(id);
    return row
      ? { exists: true, deleted: row.deleted, revision: row.revision! }
      : { exists: false, deleted: false, revision: "" };
  });
};

/** Live records under an address prefix, in UTF-16 record ID order like the in-memory storage. */
export const listProjectedRecords = async (connection: Reader, owner: StorageOwner, prefix = "") =>
  (
    await connection
      .select(projectedColumns)
      .from(current)
      .where(and(currentWhere(owner), eq(current.deleted, false), sql`starts_with(${current.record_id}, ${prefix})`))
  )
    .map(asRecord)
    .sort((left, right) => {
      if (left.recordId === right.recordId) return 0;
      return left.recordId < right.recordId ? -1 : 1;
    });
