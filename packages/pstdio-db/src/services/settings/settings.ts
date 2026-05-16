import { eq } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { settings } from "../../db/schemas.pg";

type SettingsRecord = typeof settings.$inferSelect;

type UpdateInput = Partial<Pick<SettingsRecord, "max_concurrent_sessions">>;

const GLOBAL_SETTINGS_ID = "global";

const nowTimestamp = () => new Date().toISOString();

export const createSettingsDBService = (db: DbClient) => {
  const get = async () => {
    const timestamp = nowTimestamp();
    await db
      .insert(settings)
      .values({ id: GLOBAL_SETTINGS_ID, max_concurrent_sessions: null, created_at: timestamp, updated_at: timestamp })
      .onConflictDoNothing();

    const [row] = await db.select().from(settings).where(eq(settings.id, GLOBAL_SETTINGS_ID));
    return row;
  };

  const update = async (input: UpdateInput) => {
    await get();
    const [updated] = await db
      .update(settings)
      .set({ ...input, updated_at: nowTimestamp() })
      .where(eq(settings.id, GLOBAL_SETTINGS_ID))
      .returning();
    return updated;
  };

  return { get, update };
};
