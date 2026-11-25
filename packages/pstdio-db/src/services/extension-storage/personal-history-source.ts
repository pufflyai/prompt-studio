import { and, eq, gt, isNull, sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import type { StorageLogEntry } from "pstdio-sync-contracts";
import type { DbClient } from "../../db/connection.pglite";
import {
  storage_log_entries as logEntries,
  owners,
  storage_personal_history_sources as sources,
} from "../../db/schemas.pg";
import { decodeLogValue, logWhere } from "./ordered-log-sql";
import type { PersonalIndexAccepted } from "./personal-history-index";
import {
  applyPersonalIndexRows,
  type PersonalIndexTransaction,
  personalIndexAddress,
} from "./personal-history-index-rows";
import { personalIndexPages } from "./personal-index-pages";
import { ensureStorageOwner, storageOwnerKey, storageOwnerWhere } from "./storage-owner-key";

const parsePositions = (cursor: string | null | undefined) => {
  if (!cursor) return new Map<string, number>();
  const value = JSON.parse(cursor);
  if (
    value.version !== 2 ||
    !value.sources ||
    typeof value.sources !== "object" ||
    Array.isArray(value.sources) ||
    Object.values(value.sources).some((after) => !Number.isSafeInteger(after) || Number(after) < 0)
  )
    throw new Error("Invalid private index positions");
  return new Map(Object.entries(value.sources as Record<string, number>));
};
export const readPersonalSourcePosition = async (db: DbClient, owner: StorageOwner, sourceId: string) => {
  const [row] = await db.select({ cursor: owners.history_cursor }).from(owners).where(storageOwnerWhere(owner));
  return parsePositions(row?.cursor).get(sourceId) ?? 0;
};
export const acceptPersonalSource = async (
  tx: PersonalIndexTransaction,
  owner: StorageOwner,
  sourceId: string,
  after: number | null,
  entries: PersonalIndexAccepted[],
) => {
  await ensureStorageOwner(tx, owner);
  const [position] = await tx
    .select({ cursor: owners.history_cursor })
    .from(owners)
    .where(storageOwnerWhere(owner))
    .for("update");
  const changes: { delta: PersonalIndexAccepted["delta"]; settledId: string }[] = [];
  for (const page of personalIndexPages(entries)) {
    const updated = await tx
      .insert(sources)
      .values(
        page.map((entry) => ({
          ...personalIndexAddress(owner),
          source_id: sourceId,
          kind: entry.delta.kind,
          device_id: entry.delta.deviceId,
          record_id: entry.delta.id,
          value: entry.delta.value,
          seed_id: entry.delta.seedId ?? null,
          entry_id: entry.entryId,
          sequence: entry.sequence,
          entry_index: entry.index,
        })),
      )
      .onConflictDoUpdate({
        target: [sources.owner_id, sources.source_id, sources.kind, sources.device_id, sources.record_id],
        set: {
          value: sql`excluded.value`,
          seed_id: sql`excluded.seed_id`,
          entry_id: sql`excluded.entry_id`,
          sequence: sql`excluded.sequence`,
          entry_index: sql`excluded.entry_index`,
        },
        setWhere: sql`(${sources.sequence}, ${sources.entry_index}) <= (excluded.sequence, excluded.entry_index)`,
      })
      .returning();
    for (const row of updated)
      changes.push({
        delta: {
          kind: row.kind,
          deviceId: row.device_id,
          id: row.record_id,
          value: row.value,
          ...(row.seed_id ? { seedId: row.seed_id } : {}),
        },
        settledId: row.entry_id,
      });
  }
  const changed = await applyPersonalIndexRows(tx, owner, changes);
  if (after !== null) {
    const cursors = parsePositions(position?.cursor);
    cursors.set(sourceId, Math.max(cursors.get(sourceId) ?? 0, after));
    await tx
      .update(owners)
      .set({ history_cursor: JSON.stringify({ version: 2, sources: Object.fromEntries(cursors) }) })
      .where(storageOwnerWhere(owner));
  }
  return changed;
};
export const personalSourcePage = async (
  db: DbClient,
  owner: StorageOwner,
  sourceId: string,
  after?: { kind: string; deviceId: string; id: string },
) => {
  const selected = await db
    .select()
    .from(sources)
    .where(
      and(
        eq(sources.owner_id, storageOwnerKey(owner)),
        eq(sources.source_id, sourceId),
        after
          ? sql`(${sources.kind}, ${sources.device_id}, ${sources.record_id}) > (${after.kind}, ${after.deviceId}, ${after.id})`
          : undefined,
      ),
    )
    .orderBy(sources.kind, sources.device_id, sources.record_id)
    .limit(100);
  return selected.map((row) => ({
    entryId: row.entry_id,
    sequence: row.sequence,
    index: row.entry_index,
    delta: {
      kind: row.kind,
      deviceId: row.device_id,
      id: row.record_id,
      value: row.value,
      ...(row.seed_id ? { seedId: row.seed_id } : {}),
    },
  }));
};
export const personalPendingPage = async (db: DbClient, owner: StorageOwner, sourceId: string, after: number) => {
  const selected = await db
    .select({ entry: logEntries.entry, sequence: logEntries.local_sequence })
    .from(logEntries)
    .where(
      and(
        logWhere(logEntries, { owner, name: "index", scope: "project", stream: sourceId, writerId: sourceId }),
        eq(logEntries.local, true),
        isNull(logEntries.relay_sequence),
        gt(logEntries.local_sequence, after),
      ),
    )
    .orderBy(logEntries.local_sequence)
    .limit(100);
  return selected.map((row) => ({ entry: decodeLogValue<StorageLogEntry>(row.entry), sequence: row.sequence }));
};
