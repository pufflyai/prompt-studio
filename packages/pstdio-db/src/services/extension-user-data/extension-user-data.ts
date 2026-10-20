import { and, eq } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import {
  board_default_views,
  board_views,
  extension_collection_items,
  extension_data_versions,
  extension_files,
  extension_kv,
  extension_skill_preferences,
  extension_storage_journal,
  extension_storage_owners,
} from "../../db/schemas.pg";
import { clearOwnerDocuments } from "../extension-storage/clear-documents";
import { createDocumentStorageDBService } from "../extension-storage/document-storage";
import { getExtensionStorageOwner, hasOtherStorageProvider } from "../extension-storage/storage-owner";

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
  const documents = createDocumentStorageDBService(db);
  const hasUserData = async (extensionInstanceId: string) => {
    const owner = await getExtensionStorageOwner(db, extensionInstanceId);
    if (owner) {
      if (await documents.hasData(owner)) return true;
      const [entry] = await db
        .select({ id: extension_storage_journal.operation_id })
        .from(extension_storage_journal)
        .where(
          and(
            eq(extension_storage_journal.workbench_id, owner.workbenchId),
            eq(extension_storage_journal.extension_id, owner.extensionId),
          ),
        )
        .limit(1);
      if (entry) return true;
    }
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
      const owner = await getExtensionStorageOwner(tx, extensionInstanceId);
      if (owner && !(await hasOtherStorageProvider(tx, owner, extensionInstanceId))) {
        await clearOwnerDocuments(tx, owner);
        await tx
          .delete(extension_storage_owners)
          .where(
            and(
              eq(extension_storage_owners.workbench_id, owner.workbenchId),
              eq(extension_storage_owners.extension_id, owner.extensionId),
            ),
          );
      }
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
      await tx
        .delete(extension_data_versions)
        .where(eq(extension_data_versions.extension_instance_id, extensionInstanceId));
      return { boardViews, boardDefaults };
    });

  return { hasUserData, deleteForInstance };
};
