import { and, eq } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import type { Json } from "pstdio-sync-contracts";
import type { DbClient } from "../../db/connection.pglite";
import { storage_personal_history_positions as positions } from "../../db/schemas.pg";
import { createPersonalIndexCache } from "./personal-history-index-cache";
import { applyPersonalIndexRows } from "./personal-history-index-rows";
import { applyPendingPersonalIndex } from "./personal-history-pending";
import {
  acceptPersonalSource,
  personalPendingPage,
  personalSourcePage,
  readPersonalSourcePosition,
} from "./personal-history-source";

export interface PersonalIndexDelta {
  deviceId: string;
  kind: string;
  id: string;
  value: Json | null;
  seedId?: string;
}
export interface PersonalIndexAccepted {
  entryId: string;
  sequence: number;
  index: number;
  delta: PersonalIndexDelta;
}
const address = (owner: StorageOwner) => ({ workbench_id: owner.workbenchId, extension_id: owner.extensionId });
const positionWhere = (owner: StorageOwner) =>
  and(eq(positions.workbench_id, owner.workbenchId), eq(positions.extension_id, owner.extensionId));
export const createPersonalHistoryIndex = (db: DbClient) => {
  const cache = createPersonalIndexCache(db);
  const state = async (owner: StorageOwner) => (await db.select().from(positions).where(positionWhere(owner)))[0];
  const apply = async (
    owner: StorageOwner,
    cursor: string | null,
    changes: { delta: PersonalIndexDelta; pendingId?: string }[],
  ) => {
    const owned = structuredClone(changes);
    const current = await cache(owner);
    const applied = await db.transaction(async (tx) => {
      await tx.insert(positions).values(address(owner)).onConflictDoNothing();
      await tx.select().from(positions).where(positionWhere(owner)).for("update");
      const changed = await applyPersonalIndexRows(tx, owner, owned);
      if (cursor !== null) await tx.update(positions).set({ cursor }).where(positionWhere(owner));
      return changed;
    });
    current.apply(applied);
  };
  return {
    apply: (owner: StorageOwner, cursor: string | null, changes: PersonalIndexDelta[], pendingId?: string) =>
      apply(
        owner,
        cursor,
        changes.map((delta) => ({ delta, pendingId })),
      ),
    async applyPending(
      owner: StorageOwner,
      sourceId: string,
      changes: { delta: PersonalIndexDelta; pendingId: string }[],
    ) {
      const owned = structuredClone(changes);
      const current = await cache(owner);
      current.apply(await db.transaction((tx) => applyPendingPersonalIndex(tx, owner, sourceId, owned)));
    },
    sourcePosition: (owner: StorageOwner, sourceId: string) => readPersonalSourcePosition(db, owner, sourceId),
    pendingPage: (owner: StorageOwner, sourceId: string, after: number) =>
      personalPendingPage(db, owner, sourceId, after),
    sourcePage: (owner: StorageOwner, sourceId: string, after?: { kind: string; deviceId: string; id: string }) =>
      personalSourcePage(db, owner, sourceId, after),
    async accept(owner: StorageOwner, sourceId: string, after: number | null, entries: PersonalIndexAccepted[]) {
      const current = await cache(owner);
      const owned = structuredClone(entries);
      const changed = await db.transaction((tx) => acceptPersonalSource(tx, owner, sourceId, after, owned));
      current.apply(changed);
    },
    async read(owner: StorageOwner, kind: string) {
      return (await cache(owner)).read(kind);
    },
    async device(owner: StorageOwner, kind: string, deviceId: string) {
      return (await cache(owner)).device(kind, deviceId);
    },
    async get(owner: StorageOwner, kind: string, id: string) {
      return (await cache(owner)).get(kind, id);
    },
    async seeded(owner: StorageOwner, kind: string, deviceId: string) {
      return (await cache(owner)).seeded(kind, deviceId);
    },
    isSeeded: async (owner: StorageOwner, kind: string, deviceId: string, id: string) =>
      (await cache(owner)).isSeeded(kind, deviceId, id),
    visibleRevision: async (owner: StorageOwner) => (await cache(owner)).visibleRevision,
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
