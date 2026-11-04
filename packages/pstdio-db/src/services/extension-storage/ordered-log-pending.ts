import { and, desc, eq, gte, isNull, lte } from "drizzle-orm";
import type { LogDelivery } from "pstdio-sync/logs";
import type { StorageLogEntry } from "pstdio-sync-contracts";
import type { DbClient } from "../../db/connection.pglite";
import { storage_log_entries as entries } from "../../db/schemas.pg";
import { decodeLogPayload, logCutoff, logWhere, type OrderedLogAddress } from "./ordered-log-sql";

export const orderedLogPendingThrough = async (db: DbClient, input: OrderedLogAddress) => {
  const [row] = await db
    .select({ value: entries.local_sequence })
    .from(entries)
    .where(and(logWhere(entries, input), eq(entries.local, true), isNull(entries.relay_sequence)))
    .orderBy(desc(entries.local_sequence))
    .limit(1);
  return row?.value ?? 0;
};
export const readOrderedLogPending = async (
  db: DbClient,
  input: OrderedLogAddress,
  limit: number,
  through?: number,
) => {
  const rows = await db
    .select()
    .from(entries)
    .where(
      and(
        logWhere(entries, input),
        eq(entries.local, true),
        isNull(entries.relay_sequence),
        through === undefined ? undefined : lte(entries.local_sequence, through),
        input.keep && gte(entries.created_at, logCutoff(input)),
      ),
    )
    .orderBy(entries.local_sequence)
    .limit(limit);
  return Promise.all(
    rows.map(async (row) => ({
      entry: await decodeLogPayload<StorageLogEntry>(input, row.entry),
      delivery: row.envelope ? await decodeLogPayload<LogDelivery>(input, row.envelope) : undefined,
    })),
  );
};
