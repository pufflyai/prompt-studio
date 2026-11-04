import { and, asc, desc, eq, gt, gte, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import {
  decodeLogCursor,
  encodeLogCursor,
  type LogKnownEntry,
  type LogReadPlan,
  logBatchEnd,
  logPageLimit,
} from "pstdio-sync/logs";
import type { StorageLogEntry, StorageLogRead } from "pstdio-sync-contracts";
import type { DbClient } from "../../db/connection.pglite";
import { storage_log_entries as entries, storage_log_streams as streams } from "../../db/schemas.pg";
import { decodeLogPayload, logAddressKey, logCutoff, logWhere, type OrderedLogAddress } from "./ordered-log-sql";

const metadata = {
  id: entries.entry_id,
  writerId: entries.writer_id,
  createdAt: entries.created_at,
  sequence: entries.relay_sequence,
  index: entries.relay_index,
  localSequence: entries.local_sequence,
  local: entries.local,
};
type Row = Omit<LogKnownEntry, "createdAt"> & { createdAt: number };
const asMetadata = (row: Row): LogKnownEntry => ({ ...row, createdAt: new Date(row.createdAt).toISOString() });

export const lookupOrderedLogMetadata = async (
  db: Pick<DbClient, "select">,
  input: OrderedLogAddress,
  ids: readonly string[],
) => {
  if (!ids.length) return [];
  const rows = await db
    .select(metadata)
    .from(entries)
    .where(and(logWhere(entries, input), inArray(entries.entry_id, [...ids])));
  return rows.map(asMetadata);
};

const selectedMetadata = async (db: Pick<DbClient, "select">, input: OrderedLogAddress, options: StorageLogRead) => {
  const cursor = decodeLogCursor(logAddressKey(input), options.after);
  const limit = logPageLimit(options.limit);
  const retained = input.keep ? gte(entries.created_at, logCutoff(input)) : undefined;
  const pendingRows = async (count: number, newest: boolean) =>
    db
      .select(metadata)
      .from(entries)
      .where(
        and(
          logWhere(entries, input),
          eq(entries.local, true),
          isNull(entries.relay_sequence),
          newest ? undefined : gt(entries.local_sequence, cursor.local),
          retained,
        ),
      )
      .orderBy((newest ? desc : asc)(entries.local_sequence))
      .limit(count);
  const [status] = await db.select().from(streams).where(logWhere(streams, input));
  if (options.newest) {
    const pending = await pendingRows(limit, true);
    const canonical = await db
      .select(metadata)
      .from(entries)
      .where(and(logWhere(entries, input), isNotNull(entries.relay_sequence), retained))
      .orderBy(desc(entries.relay_sequence), desc(entries.relay_index))
      .limit(limit - pending.length);
    return {
      cursor,
      rows: [...canonical.reverse(), ...pending.reverse()],
      more: false,
      end: {
        ...cursor,
        relay: status?.head ?? 0,
        index: logBatchEnd,
        local: pending.at(-1)?.localSequence ?? cursor.local,
      },
    };
  }
  const canonical = await db
    .select(metadata)
    .from(entries)
    .where(
      and(
        logWhere(entries, input),
        isNotNull(entries.relay_sequence),
        retained,
        sql`(${entries.relay_sequence}, ${entries.relay_index}) > (${cursor.relay}, ${cursor.index})`,
        or(eq(entries.local, false), gt(entries.local_sequence, cursor.local)),
      ),
    )
    .orderBy(entries.relay_sequence, entries.relay_index)
    .limit(limit + 1);
  const picked = canonical.slice(0, limit);
  const last = picked.at(-1);
  let end = { ...cursor, relay: last?.sequence ?? cursor.relay, index: last?.index ?? cursor.index };
  if (canonical.length > limit) return { cursor, rows: picked, more: true, end };
  const pending = await pendingRows(limit - picked.length + 1, false);
  const selected = pending.slice(0, limit - picked.length);
  end.local = selected.at(-1)?.localSequence ?? end.local;
  if (status && status.complete_through >= status.head) end = { ...end, relay: status.head, index: logBatchEnd };
  return { cursor, rows: [...picked, ...selected], more: pending.length > selected.length, end };
};

/** Column-only candidate selection; entry ciphertext is selected and opened only for chosen identities. */
export const planOrderedLog = async (
  db: DbClient,
  input: OrderedLogAddress,
  options: StorageLogRead = {},
): Promise<LogReadPlan> => {
  const selected = await db.transaction((tx) => selectedMetadata(tx, input, structuredClone(options)), {
    isolationLevel: "repeatable read",
    accessMode: "read only",
  });
  const known = new Map(selected.rows.map((row) => [row.id, row]));
  let position = { ...selected.cursor };
  return {
    entries: selected.rows.map((row) => {
      position =
        row.sequence === null
          ? { ...position, local: row.localSequence }
          : { ...position, relay: row.sequence, index: row.index! };
      return {
        id: row.id,
        writerId: row.writerId,
        createdAt: new Date(row.createdAt).toISOString(),
        cursor: encodeLogCursor(position),
      };
    }),
    cursor: encodeLogCursor(selected.end),
    more: selected.more,
    async materialize(ids) {
      if (new Set(ids).size !== ids.length || ids.some((id) => !known.has(id)))
        throw new Error("Unplanned log payload identity");
      if (!ids.length) return [];
      const rows = await db
        .select({ id: entries.entry_id, entry: entries.entry })
        .from(entries)
        .where(and(logWhere(entries, input), inArray(entries.entry_id, [...ids])));
      const payloads = new Map<string, StorageLogEntry>();
      for (const row of rows) {
        const expected = known.get(row.id)!;
        if (expected.createdAt < logCutoff(input)) continue;
        const value = await decodeLogPayload<StorageLogEntry>(input, row.entry);
        if (
          value.id !== expected.id ||
          value.writerId !== expected.writerId ||
          Date.parse(value.createdAt) !== expected.createdAt
        )
          throw new Error("Cached log metadata differs from its payload");
        payloads.set(row.id, value);
      }
      return ids.flatMap((id) => {
        const value = payloads.get(id);
        if (!value && known.get(id)!.createdAt >= logCutoff(input)) throw new Error("A planned log payload is missing");
        return value ? [value] : [];
      });
    },
  };
};
