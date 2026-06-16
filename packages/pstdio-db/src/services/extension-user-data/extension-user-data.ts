import { eq } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import {
  extension_collection_items,
  extension_files,
  extension_kv,
  extension_skill_preferences,
  extension_template_preferences,
} from "../../db/schemas.pg";

// Every table that anchors user-owned data to an extension instance. The instance row is a
// disposable install artifact, so destroying these rows must be an explicit decision rather than a
// silent FK cascade.
const userDataTables = [
  extension_collection_items,
  extension_kv,
  extension_files,
  extension_template_preferences,
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

  const deleteForInstance = async (extensionInstanceId: string) => {
    for (const table of userDataTables) {
      await db.delete(table).where(eq(table.extension_instance_id, extensionInstanceId));
    }
  };

  return { hasUserData, deleteForInstance };
};
