import { and, asc, desc, eq, gt, gte, isNotNull, isNull, or, sql } from "drizzle-orm";
import { decodeLogCursor, encodeLogCursor, logBatchEnd, logPageLimit } from "pstdio-sync/logs";
import type { StorageLogEntry, StorageLogRead } from "pstdio-sync-contracts";
import type { DbClient } from "../../db/connection.pglite";
import { storage_log_entries as entries, storage_log_streams as streams } from "../../db/schemas.pg";
import { readNewestOrderedLog } from "./ordered-log-newest";
import { decodeLogPayload, logAddressKey, logCutoff, logWhere, type OrderedLogAddress } from "./ordered-log-sql";

export const readOrderedLog = async (
  db: Pick<DbClient, "select">,
  input: OrderedLogAddress,
  options: StorageLogRead = {},
) => {
  if (options.newest) return readNewestOrderedLog(db, input, options);
  const cursor = decodeLogCursor(logAddressKey(input), options.after);
  const limit = logPageLimit(options.limit);
  const order = options.newest ? desc : asc;
  const canonical = await db
    .select()
    .from(entries)
    .where(
      and(
        logWhere(entries, input),
        isNotNull(entries.relay_sequence),
        input.keep && gte(entries.created_at, logCutoff(input)),
        options.newest
          ? undefined
          : sql`(${entries.relay_sequence}, ${entries.relay_index}) > (${cursor.relay}, ${cursor.index})`,
        or(eq(entries.local, false), gt(entries.local_sequence, cursor.local)),
      ),
    )
    .orderBy(order(entries.relay_sequence), order(entries.relay_index))
    .limit(limit + 1);
  const moreCanonical = canonical.length > limit;
  const selected = canonical.slice(0, limit);
  if (options.newest) selected.reverse();
  const last = selected.at(-1);
  const next = { ...cursor, relay: last?.relay_sequence ?? cursor.relay, index: last?.relay_index ?? cursor.index };
  const values = await Promise.all(selected.map((row) => decodeLogPayload<StorageLogEntry>(input, row.entry)));
  // Do not mark optimistic entries displayed until all earlier canonical entries were delivered.
  if (moreCanonical) return { entries: values, cursor: encodeLogCursor(next), more: true };
  const pending = await db
    .select()
    .from(entries)
    .where(
      and(
        logWhere(entries, input),
        eq(entries.local, true),
        isNull(entries.relay_sequence),
        gt(entries.local_sequence, cursor.local),
        input.keep && gte(entries.created_at, logCutoff(input)),
      ),
    )
    .orderBy(order(entries.local_sequence))
    .limit(limit - values.length + 1);
  const morePending = pending.length > limit - values.length;
  const picked = pending.slice(0, limit - values.length);
  if (options.newest) picked.reverse();
  values.push(...(await Promise.all(picked.map((row) => decodeLogPayload<StorageLogEntry>(input, row.entry)))));
  next.local = picked.at(-1)?.local_sequence ?? cursor.local;
  const [stream] = await db.select().from(streams).where(logWhere(streams, input));
  if (stream && (options.newest || stream.complete_through >= stream.head)) {
    next.relay = stream.head;
    next.index = logBatchEnd;
  }
  return { entries: values, cursor: encodeLogCursor(next), more: morePending };
};
