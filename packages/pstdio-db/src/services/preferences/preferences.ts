import { and, eq } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { preferences } from "../../db/schemas/preferences";

export type PreferenceOwner = Pick<typeof preferences.$inferSelect, "scope" | "scope_id" | "extension_id">;
export type PreferenceKey = PreferenceOwner & { key: string };
export type PreferenceInput = PreferenceKey &
  Pick<typeof preferences.$inferSelect, "sync" | "value"> & {
    project_id?: string | null;
    updated_at?: string;
  };

export const preferenceOwnerWhere = (owner: PreferenceOwner) =>
  and(
    eq(preferences.scope, owner.scope),
    eq(preferences.scope_id, owner.scope_id),
    eq(preferences.extension_id, owner.extension_id),
  );

export const createPreferencesDBService = (db: Pick<DbClient, "select" | "insert" | "delete">) => {
  const whereKey = (input: PreferenceKey) => and(preferenceOwnerWhere(input), eq(preferences.key, input.key));
  return {
    async get(input: PreferenceKey) {
      const [row] = await db.select().from(preferences).where(whereKey(input));
      return row ?? null;
    },
    list: (owner: PreferenceOwner) =>
      db.select().from(preferences).where(preferenceOwnerWhere(owner)).orderBy(preferences.key),
    async set(input: PreferenceInput) {
      const row = { ...input, updated_at: input.updated_at ?? new Date().toISOString() };
      const [stored] = await db
        .insert(preferences)
        .values(row)
        .onConflictDoUpdate({
          target: [preferences.scope, preferences.scope_id, preferences.extension_id, preferences.key],
          set: { sync: row.sync, value: row.value, project_id: row.project_id ?? null, updated_at: row.updated_at },
        })
        .returning();
      return stored!;
    },
    async remove(input: PreferenceKey) {
      const rows = await db.delete(preferences).where(whereKey(input)).returning({ key: preferences.key });
      return rows.length > 0;
    },
  };
};
