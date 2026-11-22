import { isDeepStrictEqual } from "node:util";
import { and, eq, sql } from "drizzle-orm";
import { ensureStorageOwner } from "../services/extension-storage/storage-owner-key";
import type { DbClient } from "./connection.pglite";
import { storage_log_entries as entries, storage_log_streams as streams } from "./schemas.pg";
import { decodeUpgradeBytes as decodeBytes } from "./upgrade-bytes";
import { prepareUpgradeSnapshot } from "./upgrade-snapshot";

type LegacyAddress = {
  workbench_id: string;
  extension_id: string;
  log_name: string;
  scope: string;
  stream: string;
};
type LegacyStream = LegacyAddress & {
  head: number;
  complete_through: number;
  state_id: string | null;
  through: number;
};
type LegacyEntry = LegacyAddress &
  Omit<typeof entries.$inferSelect, "stream_id" | "entry" | "envelope"> & {
    entry: string;
    envelope: string | null;
  };
const streamWhere = (ownerId: number, row: LegacyAddress) =>
  and(
    eq(streams.owner_id, ownerId),
    eq(streams.log_name, row.log_name),
    eq(streams.scope, row.scope),
    eq(streams.stream, row.stream),
  );
const ownerOf = (row: LegacyAddress) => ({ workbenchId: row.workbench_id, extensionId: row.extension_id });

/** Capture both released tables before generated DDL; keep exact rows for recovery. */
export const prepareLogOwnerUpgrade = async (db: DbClient, path: string) => {
  let sequence: { lastValue: number; called: boolean } | undefined;
  const restoreSequence = await prepareUpgradeSnapshot(
    db,
    path,
    {
      table: "storage_log_entries_local_sequence_seq",
      keys: ["last_value"],
      name: "log-local-sequence",
      archive: "log-local-sequence",
    },
    async (row) => {
      if (typeof row.is_called !== "boolean") throw new Error("Invalid exported log sequence");
      sequence = { lastValue: Number(row.last_value), called: row.is_called };
    },
  );
  const restoreStreams = await prepareUpgradeSnapshot(
    db,
    path,
    {
      table: "storage_log_streams",
      keys: ["workbench_id", "extension_id", "log_name", "scope", "stream"],
      name: "log-stream-owners",
      archive: "log-streams",
    },
    async (input) => {
      const row = input as unknown as LegacyStream;
      await db.transaction(async (tx) => {
        const ownerId = await ensureStorageOwner(tx, ownerOf(row));
        const expected = {
          owner_id: ownerId,
          log_name: row.log_name,
          scope: row.scope,
          stream: row.stream,
          head: Number(row.head),
          complete_through: Number(row.complete_through),
          state_id: row.state_id,
          through: Number(row.through),
        };
        const [existing] = await tx.select().from(streams).where(streamWhere(ownerId, row));
        if (existing) {
          const { id: _id, ...retained } = existing;
          if (!isDeepStrictEqual(retained, expected)) throw new Error("Log stream restoration conflict");
        } else await tx.insert(streams).values(expected);
      });
    },
  );
  const restoreEntries = await prepareUpgradeSnapshot(
    db,
    path,
    {
      table: "storage_log_entries",
      keys: ["workbench_id", "extension_id", "log_name", "scope", "stream", "entry_id"],
      name: "log-entry-streams",
      archive: "log-entries",
    },
    async (input) => {
      const row = input as unknown as LegacyEntry;
      await db.transaction(async (tx) => {
        const ownerId = await ensureStorageOwner(tx, ownerOf(row));
        const [stream] = await tx.select({ id: streams.id }).from(streams).where(streamWhere(ownerId, row));
        if (!stream) throw new Error("An exported log entry has no restored stream");
        const {
          workbench_id: _project,
          extension_id: _extension,
          log_name: _name,
          scope: _scope,
          stream: _stream,
          ...fields
        } = row;
        const expected = {
          ...fields,
          created_at: Number(row.created_at),
          local_sequence: Number(row.local_sequence),
          relay_sequence: row.relay_sequence === null ? null : Number(row.relay_sequence),
          stream_id: stream.id,
          entry: decodeBytes(row.entry),
          envelope: row.envelope === null ? null : decodeBytes(row.envelope),
        };
        const [existing] = await tx
          .select()
          .from(entries)
          .where(and(eq(entries.stream_id, stream.id), eq(entries.entry_id, row.entry_id)));
        if (existing) {
          if (!isDeepStrictEqual(existing, expected)) throw new Error("Log entry restoration conflict");
        } else await tx.insert(entries).values(expected);
      });
    },
    async (row) => ({
      ...row,
      entry: `\\x${Buffer.from(row.entry as Uint8Array).toString("hex")}`,
      envelope: row.envelope === null ? null : `\\x${Buffer.from(row.envelope as Uint8Array).toString("hex")}`,
    }),
  );
  if (!restoreStreams && !restoreEntries && !restoreSequence) return;
  return async () => {
    await restoreStreams?.(true);
    await restoreEntries?.(true);
    await restoreSequence?.(true);
    // Public cursors can name rows already removed by retention: preserve the sequence,
    // not just the maximum position of the entries that survived.
    await db.execute(sql`SELECT setval(pg_get_serial_sequence('log_entries', 'local_sequence'),
      GREATEST(COALESCE((SELECT max(local_sequence) FROM log_entries), 1),
        ${sequence?.lastValue ?? 1}, (SELECT last_value FROM log_entries_local_sequence_seq)),
      ${sequence?.called ?? false} OR EXISTS (SELECT 1 FROM log_entries)
        OR (SELECT is_called FROM log_entries_local_sequence_seq))`);
    await restoreEntries?.complete();
    await restoreStreams?.complete();
    await restoreSequence?.complete();
  };
};
