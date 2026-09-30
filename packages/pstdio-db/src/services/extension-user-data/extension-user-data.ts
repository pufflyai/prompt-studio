import { eq } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import {
  board_default_views,
  board_views,
  extension_collection_items,
  extension_files,
  extension_kv,
  extension_skill_preferences,
} from "../../db/schemas.pg";

// Every table that anchors user-owned data to an extension instance. The instance row is a
// disposable install artifact, so destroying these rows must be an explicit decision rather than a
// silent FK cascade.
const userDataTables = [
  board_default_views,
  board_views,
  extension_collection_items,
  extension_kv,
  extension_files,
  extension_skill_preferences,
] as const;

export const createExtensionUserDataDBService = (db: DbClient) => {
  const hasUserData = async (extensionInstanceId: string) => {
    for (const table of userDataTables) {
      const [row] = await db
        .select({ instance: table.extension_instance_id })
        .from(table)
        .where(eq(table.extension_instance_id, extensionInstanceId))
        .limit(1);
      if (row) return true;
    }
    return false;
  };

  const deleteForInstance = (extensionInstanceId: string) =>
    db.transaction(async (tx) => {
      const boardDefaults = await tx
        .delete(board_default_views)
        .where(eq(board_default_views.extension_instance_id, extensionInstanceId))
        .returning();
      const boardViews = await tx
        .delete(board_views)
        .where(eq(board_views.extension_instance_id, extensionInstanceId))
        .returning();
      for (const table of userDataTables) {
        if (table === board_views || table === board_default_views) continue;
        await tx.delete(table).where(eq(table.extension_instance_id, extensionInstanceId));
      }
      return { boardViews, boardDefaults };
    });

  return { hasUserData, deleteForInstance };
};
