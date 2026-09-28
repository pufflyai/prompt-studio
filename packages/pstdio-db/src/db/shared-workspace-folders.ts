import type { PGlite } from "@electric-sql/pglite";
import type { DbClient } from "./connection.pglite";
import { migrateThrough } from "./migrate-through";

const FOLDER_PATH_MIGRATION = 32;

// Older hosts let several workspaces point at one folder, and the folder upgrade kept them all.
// Before the one-workspace-per-folder index exists, soft-delete the extra ones so their history stays readable.
export const removeSharedWorkspaceFolders = async (pglite: PGlite, db: DbClient, migrationsFolder: string) => {
  const state = await pglite.query<{ pending: boolean }>(
    "SELECT to_regclass('public.workspaces') IS NOT NULL AND to_regclass('public.workspaces_active_root_path_idx') IS NULL AS pending",
  );
  if (!state.rows[0]?.pending) return;
  await migrateThrough(db, migrationsFolder, FOLDER_PATH_MIGRATION);
  const now = new Date().toISOString();
  await pglite.transaction(async (tx) => {
    // A folder is the home of one project. The newest project keeps it; a project without a home cannot work.
    await tx.query(
      `WITH homes AS (
        SELECT w.project_id, row_number() OVER (PARTITION BY w.root_path ORDER BY w.created_at DESC, w.id DESC) AS rank
        FROM workspaces w JOIN projects p ON p.id = w.project_id
        WHERE w.is_default AND w.deleted_at IS NULL AND w.root_path IS NOT NULL AND p.deleted_at IS NULL
      )
      UPDATE projects SET deleted_at = $1, updated_at = $1 WHERE id IN (SELECT project_id FROM homes WHERE rank > 1)`,
      [now],
    );
    // Deleted projects cannot be opened, so their workspaces must not hold folders.
    await tx.query(
      `UPDATE workspaces SET deleted_at = $1, archived = true, updated_at = $1
      WHERE deleted_at IS NULL AND project_id IN (SELECT id FROM projects WHERE deleted_at IS NOT NULL)`,
      [now],
    );
    await tx.query(
      `WITH ranked AS (
        SELECT id, row_number() OVER (
          PARTITION BY root_path ORDER BY is_default DESC, archived, created_at DESC, id DESC
        ) AS rank
        FROM workspaces WHERE deleted_at IS NULL AND root_path IS NOT NULL
      )
      UPDATE workspaces SET deleted_at = $1, archived = true, updated_at = $1
      WHERE id IN (SELECT id FROM ranked WHERE rank > 1)`,
      [now],
    );
  });
};
