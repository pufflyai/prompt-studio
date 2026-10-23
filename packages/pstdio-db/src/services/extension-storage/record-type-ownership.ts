import { sql } from "drizzle-orm";
import type { RecordType } from "pstdio-sync";
import type { DbClient } from "../../db/connection.pglite";
import type { DocumentAddress } from "./document-persistence";

type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];

/** Caller holds the authoritative document row lock. Full names resolve hash collisions. */
export const insertRecordTypeOwnership = async (
  tx: Transaction,
  address: DocumentAddress,
  types: (RecordType & { recordId: string })[],
) => {
  const unique = [...new Map(types.map((type) => [type.name, type])).values()];
  if (!unique.length) return;
  await tx.execute(sql`
    INSERT INTO storage_record_types (workbench_id, extension_id, type_name, type_kind, record_id)
    SELECT ${address.workbench_id}, ${address.extension_id}, candidate.name, candidate.kind, candidate."recordId"
    FROM jsonb_to_recordset(${JSON.stringify(unique)}::jsonb) AS candidate(name text, kind text, "recordId" text)
    WHERE NOT EXISTS (
      SELECT 1 FROM storage_record_types AS existing
      WHERE existing.workbench_id = ${address.workbench_id} AND existing.extension_id = ${address.extension_id}
        AND md5(existing.type_name) = md5(candidate.name) AND existing.type_name = candidate.name
    )
  `);
};
