import { and, inArray } from "drizzle-orm";
import { canonicalJson, fingerprint, type Json, type StorageLogEntry } from "pstdio-sync-contracts";
import { storage_log_entries as entries } from "../../db/schemas.pg";
import {
  decodeLogPayload,
  encodeLogPayload,
  type LogTransaction,
  logAddress,
  logWhere,
  type OrderedLogAddress,
} from "./ordered-log-sql";

export const identityError = () => new Error("Log entry identity reused with changed content");
export const validateEntry = (entry: StorageLogEntry) => {
  if (!entry.id || !entry.writerId || !Number.isFinite(Date.parse(entry.createdAt)))
    throw new Error("Invalid log entry");
  canonicalJson(entry.value);
};

const insertRows = async (tx: LogTransaction, rows: (typeof entries.$inferInsert)[]) => {
  let offset = 0;
  while (offset < rows.length) {
    const page: typeof rows = [];
    let bytes = 0;
    while (offset < rows.length) {
      const row = rows[offset]!;
      const size = (row.entry as Uint8Array).byteLength;
      if (page.length && bytes + size > 4_000_000) break;
      page.push(row);
      bytes += size;
      offset++;
    }
    await tx.insert(entries).values(page);
  }
};

/** One locked page uses one selected-ID read and bounded inserts, including duplicate identities. */
export const appendOrderedLogEntries = async (
  tx: LogTransaction,
  input: OrderedLogAddress,
  owned: { id: string; value: Json }[],
) => {
  const previous = owned.length
    ? await tx
        .select()
        .from(entries)
        .where(
          and(
            logWhere(entries, input),
            inArray(
              entries.entry_id,
              owned.map((item) => item.id),
            ),
          ),
        )
    : [];
  const known = new Map(
    await Promise.all(
      previous.map(async (row) => [row.entry_id, await decodeLogPayload<StorageLogEntry>(input, row.entry)] as const),
    ),
  );
  const appended: StorageLogEntry[] = [];
  const pending: (typeof entries.$inferInsert)[] = [];
  for (const item of owned) {
    const id = item.id;
    const entry = known.get(id);
    if (entry) {
      if (entry.writerId !== input.writerId || canonicalJson(entry.value) !== canonicalJson(item.value))
        throw identityError();
      appended.push(entry);
      continue;
    }
    const created = {
      id,
      writerId: input.writerId,
      createdAt: new Date((input.now ?? Date.now)()).toISOString(),
      value: item.value,
    };
    validateEntry(created);
    pending.push({
      ...logAddress(input),
      entry_id: id,
      writer_id: input.writerId,
      created_at: Date.parse(created.createdAt),
      fingerprint: await fingerprint(created as unknown as Json),
      entry: await encodeLogPayload(input, created),
      local: true,
    });
    known.set(id, created);
    appended.push(created);
  }
  await insertRows(tx, pending);
  return { entries: appended, count: pending.length };
};
