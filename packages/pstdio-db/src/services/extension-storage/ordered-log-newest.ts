import { and, desc, eq, gte, isNotNull, isNull } from "drizzle-orm";
import { decodeLogCursor, encodeLogCursor, logBatchEnd, logPageLimit } from "pstdio-sync/logs";
import type { StorageLogEntry, StorageLogRead } from "pstdio-sync-contracts";
import type { DbClient } from "../../db/connection.pglite";
import { storage_log_entries as entries, storage_log_streams as streams } from "../../db/schemas.pg";
import { decodeLogPayload, logAddressKey, logCutoff, logWhere, type OrderedLogAddress } from "./ordered-log-sql";

export const readNewestOrderedLog = async (
  db: Pick<DbClient, "select">,
  input: OrderedLogAddress,
  options: StorageLogRead,
) => {
  const limit = logPageLimit(options.limit);
  const cursor = decodeLogCursor(logAddressKey(input), options.after);
  const pending = await db
    .select()
    .from(entries)
    .where(
      and(
        logWhere(entries, input),
        eq(entries.local, true),
        isNull(entries.relay_sequence),
        input.keep && gte(entries.created_at, logCutoff(input)),
      ),
    )
    .orderBy(desc(entries.local_sequence))
    .limit(limit);
  const canonical = await db
    .select()
    .from(entries)
    .where(
      and(
        logWhere(entries, input),
        isNotNull(entries.relay_sequence),
        input.keep && gte(entries.created_at, logCutoff(input)),
      ),
    )
    .orderBy(desc(entries.relay_sequence), desc(entries.relay_index))
    .limit(limit - pending.length);
  const [stream] = await db.select().from(streams).where(logWhere(streams, input));
  const next = {
    ...cursor,
    relay: stream?.head ?? 0,
    index: logBatchEnd,
    local: pending[0]?.local_sequence ?? cursor.local,
  };
  return {
    entries: await Promise.all(
      [...canonical.reverse(), ...pending.reverse()].map((row) => decodeLogPayload<StorageLogEntry>(input, row.entry)),
    ),
    cursor: encodeLogCursor(next),
    more: false,
  };
};
