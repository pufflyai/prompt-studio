import { and, eq, gt, isNotNull } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import type { Json } from "pstdio-sync-contracts";
import type { DbClient } from "../../db/connection.pglite";
import { storage_personal_history_positions as positions, storage_personal_history as rows } from "../../db/schemas.pg";

export interface PersonalIndexDelta {
  deviceId: string;
  kind: string;
  id: string;
  value: Json | null;
  seedId?: string;
}
const address = (owner: StorageOwner) => ({ workbench_id: owner.workbenchId, extension_id: owner.extensionId });
const where = (owner: StorageOwner) =>
  and(eq(rows.workbench_id, owner.workbenchId), eq(rows.extension_id, owner.extensionId));
const positionWhere = (owner: StorageOwner) =>
  and(eq(positions.workbench_id, owner.workbenchId), eq(positions.extension_id, owner.extensionId));
export const createPersonalHistoryIndex = (db: DbClient) => {
  const state = async (owner: StorageOwner) => (await db.select().from(positions).where(positionWhere(owner)))[0];
  return {
    async apply(owner: StorageOwner, cursor: string | null, changes: PersonalIndexDelta[]) {
      const owned = structuredClone(changes);
      await db.transaction(async (tx) => {
        await tx.insert(positions).values(address(owner)).onConflictDoNothing();
        await tx.select().from(positions).where(positionWhere(owner)).for("update");
        for (const delta of owned) {
          const key = { ...address(owner), device_id: delta.deviceId, kind: delta.kind, record_id: delta.id };
          await tx
            .insert(rows)
            .values({ ...key, value: delta.value, seed_id: delta.seedId ?? null })
            .onConflictDoUpdate({
              target: [rows.workbench_id, rows.extension_id, rows.kind, rows.device_id, rows.record_id],
              set: { value: delta.value, seed_id: delta.seedId ?? null },
              setWhere: delta.seedId ? and(isNotNull(rows.seed_id), gt(rows.seed_id, delta.seedId)) : undefined,
            });
        }
        if (cursor !== null) await tx.update(positions).set({ cursor }).where(positionWhere(owner));
      });
    },
    async read(owner: StorageOwner, kind: string) {
      return (
        await db
          .select({ value: rows.value })
          .from(rows)
          .where(and(where(owner), eq(rows.kind, kind), isNotNull(rows.value)))
          .orderBy(rows.device_id, rows.record_id)
      ).map(({ value }) => value as Record<string, unknown>);
    },
    async device(owner: StorageOwner, kind: string, deviceId: string) {
      return (
        await db
          .select({ value: rows.value })
          .from(rows)
          .where(and(where(owner), eq(rows.kind, kind), eq(rows.device_id, deviceId), isNotNull(rows.value)))
          .orderBy(rows.record_id)
      ).map(({ value }) => value as Record<string, unknown>);
    },
    async get(owner: StorageOwner, kind: string, id: string) {
      const [row] = await db
        .select({ value: rows.value })
        .from(rows)
        .where(and(where(owner), eq(rows.kind, kind), eq(rows.record_id, id)))
        .limit(1);
      return (row?.value ?? undefined) as Record<string, unknown> | undefined;
    },
    async seeded(owner: StorageOwner, kind: string, deviceId: string) {
      return new Set(
        (
          await db
            .select({ id: rows.record_id })
            .from(rows)
            .where(and(where(owner), eq(rows.kind, kind), eq(rows.device_id, deviceId), isNotNull(rows.seed_id)))
        ).map((row) => row.id),
      );
    },
    cursor: async (owner: StorageOwner) => (await state(owner))?.cursor ?? null,
    migrated: async (owner: StorageOwner) => (await state(owner))?.migrated ?? false,
    async markMigrated(owner: StorageOwner) {
      await db
        .insert(positions)
        .values({ ...address(owner), migrated: true })
        .onConflictDoUpdate({
          target: [positions.workbench_id, positions.extension_id],
          set: { migrated: true },
        });
    },
  };
};
