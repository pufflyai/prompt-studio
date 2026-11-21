import { and, eq, not, sql } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { board_views, extension_files, preferences } from "../../db/schemas.pg";
import { listBoardDefaults } from "../board-views/board-defaults";
import { clearOwnerDocuments } from "../extension-storage/clear-documents";
import { createDocumentStorageDBService } from "../extension-storage/document-storage";
import { indexNodeFilesFor } from "../extension-storage/index-node-files";
import { getExtensionStorageOwner, hasOtherStorageProvider } from "../extension-storage/storage-owner";

// Every table that anchors user-owned data to an extension instance. The instance row is a
// disposable install artifact, so destroying these rows must be an explicit decision rather than a
// silent FK cascade.
const userDataTables = [board_views, extension_files] as const;
const instancePreferences = (instanceId: string) =>
  and(
    eq(preferences.scope, "project"),
    eq(preferences.scope_id, instanceId),
    sql`(starts_with(${preferences.key}, 'setting:') OR starts_with(${preferences.key}, 'skill:') OR starts_with(${preferences.key}, 'automation:') OR starts_with(${preferences.key}, 'board-default:extension:'))`,
  );

export const createExtensionUserDataDBService = (db: DbClient) => {
  const documents = createDocumentStorageDBService(db);
  const hasUserData = async (extensionInstanceId: string) => {
    const owner = await getExtensionStorageOwner(db, extensionInstanceId);
    if (owner && (await documents.hasData(owner))) return true;
    const [savedPreference] = await db
      .select({ key: preferences.key })
      .from(preferences)
      .where(instancePreferences(extensionInstanceId))
      .limit(1);
    if (savedPreference) return true;
    if (owner) {
      const [sharedPreference] = await db
        .select({ key: preferences.key })
        .from(preferences)
        .where(
          and(
            eq(preferences.project_id, owner.workbenchId),
            eq(preferences.extension_id, owner.extensionId),
            not(sql`starts_with(${preferences.key}, 'automation-owner:')`),
          ),
        )
        .limit(1);
      if (sharedPreference) return true;
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

  const deleteForInstance = async (extensionInstanceId: string) => {
    let cleared: Awaited<ReturnType<typeof getExtensionStorageOwner>> = null;
    const result = await db.transaction(async (tx) => {
      const owner = await getExtensionStorageOwner(tx, extensionInstanceId);
      const boardDefaults = (await listBoardDefaults(tx, owner?.workbenchId)).filter(
        (row) => row.extension_instance_id === extensionInstanceId,
      );
      if (owner && !(await hasOtherStorageProvider(tx, owner, extensionInstanceId))) {
        await clearOwnerDocuments(tx, owner);
        await tx
          .delete(preferences)
          // Automation identity outlives tool data, like retained run history.
          .where(
            and(
              eq(preferences.project_id, owner.workbenchId),
              eq(preferences.extension_id, owner.extensionId),
              not(sql`starts_with(${preferences.key}, 'automation-owner:')`),
            ),
          );
        cleared = owner;
      }
      await tx.delete(preferences).where(instancePreferences(extensionInstanceId));
      const boardViews = await tx
        .delete(board_views)
        .where(eq(board_views.extension_instance_id, extensionInstanceId))
        .returning();
      for (const table of userDataTables) {
        if (table === board_views) continue;
        await tx.delete(table).where(eq(table.extension_instance_id, extensionInstanceId));
      }
      return { boardViews, boardDefaults };
    });
    // Index node files leave only after the rows naming them are gone.
    if (cleared) await indexNodeFilesFor(db).removeOwner(cleared);
    return result;
  };

  return { hasUserData, deleteForInstance };
};
