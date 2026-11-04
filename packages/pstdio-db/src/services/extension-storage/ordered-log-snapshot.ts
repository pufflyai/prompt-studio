import { and, gte, sql } from "drizzle-orm";
import type { StorageLogEntry } from "pstdio-sync-contracts";
import type { DbClient } from "../../db/connection.pglite";
import { storage_log_entries as entries } from "../../db/schemas.pg";
import { decodeLogPayload, logCutoff, logWhere, type OrderedLogAddress } from "./ordered-log-sql";

export const orderedLogSnapshotPage = async (
  db: DbClient,
  input: OrderedLogAddress,
  after: { sequence: number; index: number },
  limit: number,
) => {
  const rows = await db
    .select()
    .from(entries)
    .where(
      and(
        logWhere(entries, input),
        input.keep && gte(entries.created_at, logCutoff(input)),
        sql`(${entries.relay_sequence}, ${entries.relay_index}) > (${after.sequence}, ${after.index})`,
      ),
    )
    .orderBy(entries.relay_sequence, entries.relay_index)
    .limit(limit);
  return Promise.all(
    rows.map(async (row) => ({
      sequence: row.relay_sequence!,
      index: row.relay_index!,
      entry: await decodeLogPayload<StorageLogEntry>(input, row.entry),
    })),
  );
};
