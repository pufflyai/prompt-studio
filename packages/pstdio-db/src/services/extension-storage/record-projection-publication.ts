import { and, eq, ne, sql } from "drizzle-orm";
import type { RecordType } from "pstdio-sync";
import type { StorageRecord } from "pstdio-sync-contracts";
import type { DbClient } from "../../db/connection.pglite";
import { storage_current_records, storage_record_projections, storage_record_types } from "../../db/schemas.pg";
import type { DocumentAddress } from "./document-persistence";
import { encodeProjectionValue } from "./record-projection-codec";

type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];
interface Publication {
  address: DocumentAddress;
  sourceRevision: number;
  nextRevision: number;
  records: StorageRecord[];
  types: (RecordType & { recordId: string })[];
}

export const publishRecordProjection = async (tx: Transaction, input: Publication) => {
  const { address, sourceRevision, nextRevision, records, types } = input;
  const owner = { workbench_id: address.workbench_id, extension_id: address.extension_id };
  // Claim the source revision in the same transaction as the source bytes and selected rows.
  const advanced = await tx
    .update(storage_record_projections)
    .set({ revision: nextRevision })
    .where(
      and(
        eq(storage_record_projections.workbench_id, owner.workbench_id),
        eq(storage_record_projections.extension_id, owner.extension_id),
        eq(storage_record_projections.document_id, address.document_id),
        eq(storage_record_projections.revision, sourceRevision),
      ),
    )
    .returning({ revision: storage_record_projections.revision });
  if (!advanced.length) throw new Error("Storage projection is out of date; install or upgrade its indexes");
  const rows = records
    .filter((record) => record.exists)
    .map((record) => ({
      ...owner,
      record_id: record.recordId,
      deleted: record.deleted,
      value: encodeProjectionValue(record.value),
      asset: encodeProjectionValue(record.asset) as typeof record.asset,
      shared: encodeProjectionValue(record.shared) as typeof record.shared,
      revision: record.revision,
    }));
  let projected = 0;
  if (rows.length) {
    const changed = await tx
      .insert(storage_current_records)
      .values(rows)
      .onConflictDoUpdate({
        target: [
          storage_current_records.workbench_id,
          storage_current_records.extension_id,
          storage_current_records.record_id,
        ],
        set: {
          deleted: sql`excluded.deleted`,
          value: sql`excluded.value`,
          asset: sql`excluded.asset`,
          shared: sql`excluded.shared`,
          revision: sql`excluded.revision`,
        },
        setWhere: ne(storage_current_records.revision, sql`excluded.revision`),
      })
      .returning({ id: storage_current_records.record_id });
    projected = changed.length;
  }
  for (let offset = 0; offset < types.length; offset += 2_000) {
    await tx
      .insert(storage_record_types)
      .values(
        types.slice(offset, offset + 2_000).map((type) => ({
          ...owner,
          record_id: type.recordId,
          type_name: type.name,
          type_kind: type.kind,
        })),
      )
      .onConflictDoNothing();
  }
  return projected;
};
