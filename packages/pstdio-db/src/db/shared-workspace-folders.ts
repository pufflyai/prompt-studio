import type { PGlite } from "@electric-sql/pglite";
import type { DbClient } from "./connection.pglite";
import { migrateThrough } from "./migrate-through";

const FOLDER_PATH_MIGRATION = 32;

// Older hosts let several workspaces point at one folder, and the folder upgrade kept them all.
// Before the one-workspace-per-folder index exists, keep each folder's workspace from a live project,
// preferring its default and then its newest one, and soft-delete the rest so their history stays readable.
export const removeSharedWorkspaceFolders = async (pglite: PGlite, db: DbClient, migrationsFolder: string) => {
  const state = await pglite.query<{ pending: boolean }>(
    "SELECT to_regclass('public.workspaces') IS NOT NULL AND to_regclass('public.workspaces_active_root_path_idx') IS NULL AS pending",
  );
  if (!state.rows[0]?.pending) return;
  await migrateThrough(db, migrationsFolder, FOLDER_PATH_MIGRATION);
  const now = new Date().toISOString();
  await pglite.query(
    `WITH ranked AS (
      SELECT w.id, row_number() OVER (
        PARTITION BY w.root_path
        ORDER BY (p.deleted_at IS NULL) DESC, w.is_default DESC, w.created_at DESC, w.id DESC
      ) AS rank
      FROM workspaces w JOIN projects p ON p.id = w.project_id
      WHERE w.deleted_at IS NULL AND w.root_path IS NOT NULL
    )
    UPDATE workspaces SET deleted_at = $1, archived = true, updated_at = $1
    WHERE id IN (SELECT id FROM ranked WHERE rank > 1)`,
    [now],
  );
};
