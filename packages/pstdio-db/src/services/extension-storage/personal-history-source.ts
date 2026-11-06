import { and, eq, gt, isNull, sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import type { StorageLogEntry } from "pstdio-sync-contracts";
import type { DbClient } from "../../db/connection.pglite";
import {
  storage_log_entries as logEntries,
  storage_personal_history_positions as positions,
  storage_personal_history_sources as sources,
} from "../../db/schemas.pg";
import { decodeLogValue } from "./ordered-log-sql";
import type { PersonalIndexAccepted } from "./personal-history-index";
import {
  applyPersonalIndexRows,
  type PersonalIndexTransaction,
  personalIndexAddress,
} from "./personal-history-index-rows";
import { personalIndexPages } from "./personal-index-pages";

const where = (owner: StorageOwner) =>
  and(eq(positions.workbench_id, owner.workbenchId), eq(positions.extension_id, owner.extensionId));
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
  const [row] = await db.select().from(positions).where(where(owner));
  return parsePositions(row?.cursor).get(sourceId) ?? 0;
};
export const acceptPersonalSource = async (
  tx: PersonalIndexTransaction,
  owner: StorageOwner,
  sourceId: string,
  after: number | null,
  entries: PersonalIndexAccepted[],
) => {
  await tx.insert(positions).values(personalIndexAddress(owner)).onConflictDoNothing();
  const [position] = await tx.select().from(positions).where(where(owner)).for("update");
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
        target: [
          sources.workbench_id,
          sources.extension_id,
          sources.source_id,
          sources.kind,
          sources.device_id,
          sources.record_id,
        ],
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
      .update(positions)
      .set({ cursor: JSON.stringify({ version: 2, sources: Object.fromEntries(cursors) }) })
      .where(where(owner));
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
        eq(sources.workbench_id, owner.workbenchId),
        eq(sources.extension_id, owner.extensionId),
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
        eq(logEntries.workbench_id, owner.workbenchId),
        eq(logEntries.extension_id, owner.extensionId),
        eq(logEntries.log_name, "index"),
        eq(logEntries.scope, "project"),
        eq(logEntries.stream, sourceId),
        eq(logEntries.local, true),
        isNull(logEntries.relay_sequence),
        gt(logEntries.local_sequence, after),
      ),
    )
    .orderBy(logEntries.local_sequence)
    .limit(100);
  return selected.map((row) => ({ entry: decodeLogValue<StorageLogEntry>(row.entry), sequence: row.sequence }));
};
