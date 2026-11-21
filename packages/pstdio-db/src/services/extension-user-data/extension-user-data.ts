import { and, eq, not, sql } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { board_views, extension_files, preferences } from "../../db/schemas.pg";
import { listBoardDefaults } from "../board-views/board-defaults";
import { clearOwnerDocuments } from "../extension-storage/clear-documents";
import { createDocumentStorageDBService } from "../extension-storage/document-storage";
import { indexNodeFilesFor } from "../extension-storage/index-node-files";
import { getExtensionStorageOwner, hasOtherStorageProvider } from "../extension-storage/storage-owner";

// Remaining instance-owned data needs explicit deletion. Stable owner data is shared
// by all providers and leaves only when the last provider removes its data.
const userDataTables = [extension_files] as const;
const instancePreferences = (instanceId: string) =>
  and(
    eq(preferences.scope, "project"),
    eq(preferences.scope_id, instanceId),
    sql`(starts_with(${preferences.key}, 'setting:') OR starts_with(${preferences.key}, 'skill:') OR starts_with(${preferences.key}, 'automation:'))`,
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
            not(eq(preferences.key, "automation-disabled")),
          ),
        )
        .limit(1);
      if (sharedPreference) return true;
      const [view] = await db
        .select({ id: board_views.id })
        .from(board_views)
        .where(and(eq(board_views.project_id, owner.workbenchId), eq(board_views.extension_id, owner.extensionId)))
        .limit(1);
      if (view) return true;
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
      let boardDefaults: Awaited<ReturnType<typeof listBoardDefaults>> = [];
      let boardViews: Array<typeof board_views.$inferSelect> = [];
      if (owner && !(await hasOtherStorageProvider(tx, owner, extensionInstanceId))) {
        boardDefaults = (await listBoardDefaults(tx, owner.workbenchId)).filter(
          (row) => row.extension_id === owner.extensionId,
        );
        boardViews = await tx
          .delete(board_views)
          .where(and(eq(board_views.project_id, owner.workbenchId), eq(board_views.extension_id, owner.extensionId)))
          .returning();
        await clearOwnerDocuments(tx, owner);
        await tx
          .delete(preferences)
          // Device automation policy outlives tool data and retained run history.
          .where(
            and(
              eq(preferences.project_id, owner.workbenchId),
              eq(preferences.extension_id, owner.extensionId),
              not(eq(preferences.key, "automation-disabled")),
            ),
          );
        cleared = owner;
      }
      await tx.delete(preferences).where(instancePreferences(extensionInstanceId));
      for (const table of userDataTables) {
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
