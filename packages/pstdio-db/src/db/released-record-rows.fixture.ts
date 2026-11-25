import { sql } from "drizzle-orm";
import { type CanonicalRecordRow, canonicalRecordFromRow } from "../services/extension-storage/ordered-record-row";
import { encodeOrderedJson } from "../services/extension-storage/ordered-sql";
import { decodeProjectionValue } from "../services/extension-storage/record-projection-codec";
import type { DbClient } from "./connection.pglite";

const currentFacet = (row: CanonicalRecordRow & Record<string, unknown>) => {
  const { owner_id: _, meta: __, base: ___, ...current } = row;
  return {
    ...current,
    value: row.deleted ? null : row.value,
    asset: row.deleted ? null : row.asset,
    shared: row.deleted ? null : row.shared,
    native_sources: row.deleted ? {} : decodeProjectionValue(row.native_sources as never),
  };
};

/** Logical released facets for upgrade fixtures and comparison; no second live table. */
export const releasedRecordRows = async (db: Pick<DbClient, "execute">) => {
  const result: Record<string, Record<string, unknown>[]> = {
    storage_current_records: [],
    storage_ordered_records: [],
  };
  let owner = -1,
    id = "";
  for (;;) {
    const { rows } = await db.execute<
      CanonicalRecordRow & {
        owner_id: number;
        workbench_id: string;
        extension_id: string;
        revision: string | null;
      } & Record<string, unknown>
    >(sql`SELECT r.*,o.project_id AS workbench_id,o.extension_id
      FROM records r JOIN owners o ON o.id=r.owner_id WHERE (r.owner_id,r.record_id)>(${owner},${id}) ORDER BY r.owner_id,r.record_id LIMIT 100`);
    if (!rows.length) return result;
    for (const row of rows) {
      owner = row.owner_id;
      id = row.record_id;
      const canonical = canonicalRecordFromRow(row);
      const address = { workbench_id: row.workbench_id, extension_id: row.extension_id, record_id: row.record_id };
      if (canonical)
        result.storage_ordered_records!.push({
          ...address,
          state: `\\x${Buffer.from(encodeOrderedJson(canonical)).toString("hex")}`,
        });
      if (row.revision !== null) result.storage_current_records!.push(currentFacet(row));
    }
  }
};
