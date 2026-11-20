import { and, eq, inArray } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import type { StorageAggregateResult } from "pstdio-sync-contracts";
import type { DbClient } from "../../db/connection.pglite";
import { storage_record_sync as legacy, storage_ordered_owners as owners } from "../../db/schemas.pg";

/** Local epochs are fresh UUIDs after owner recreation. Joined/restored Cloud owners stay uncached. */
export const aggregateCacheEpochs = async (
  connection: Pick<DbClient, "select">,
  owner: StorageOwner,
  identities: boolean,
) => {
  const extensions = [...new Set([owner.extensionId, ...(identities ? ["pstdio"] : [])])];
  const rows = await connection
    .select({
      extensionId: owners.extension_id,
      epoch: owners.epoch,
      joined: owners.joined,
      legacyJoined: legacy.joined,
    })
    .from(owners)
    .leftJoin(legacy, and(eq(legacy.workbench_id, owners.workbench_id), eq(legacy.extension_id, owners.extension_id)))
    .where(and(eq(owners.workbench_id, owner.workbenchId), inArray(owners.extension_id, extensions)));
  if (
    rows.length !== extensions.length ||
    rows.some(
      (row) =>
        row.joined ||
        row.legacyJoined ||
        !/^local:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.epoch ?? ""),
    )
  )
    return;
  return extensions.map((id) => rows.find((row) => row.extensionId === id)!.epoch);
};

const maximumEntryBytes = 65_536;
const maximumBytes = 1_048_576;
const maximumEntries = 32;
interface Entry {
  value: StorageAggregateResult;
  bytes: number;
}
const caches = new WeakMap<object, { entries: Map<string, Entry>; bytes: number }>();

/** A query key includes its owner, full selection and committed projection/index revision. */
export const aggregateCacheFor = (db: object) => {
  let cache = caches.get(db);
  if (!cache) {
    cache = { entries: new Map(), bytes: 0 };
    caches.set(db, cache);
  }
  const state = cache;
  return {
    read(key: string) {
      const entry = state.entries.get(key);
      if (!entry) return;
      state.entries.delete(key);
      state.entries.set(key, entry);
      return structuredClone(entry.value);
    },
    remember(key: string, value: StorageAggregateResult) {
      const bytes = 2 * (key.length + JSON.stringify(value).length);
      if (bytes > maximumEntryBytes) return;
      const previous = state.entries.get(key);
      if (previous) state.bytes -= previous.bytes;
      state.entries.delete(key);
      state.entries.set(key, { value: structuredClone(value), bytes });
      state.bytes += bytes;
      while (state.bytes > maximumBytes || state.entries.size > maximumEntries) {
        const oldest = state.entries.keys().next().value!;
        state.bytes -= state.entries.get(oldest)!.bytes;
        state.entries.delete(oldest);
      }
    },
  };
};
