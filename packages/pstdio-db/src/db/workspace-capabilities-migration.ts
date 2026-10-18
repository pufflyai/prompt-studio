import type { PGlite } from "@electric-sql/pglite";

// Keep data conversion separate from generated schema migrations. The predicate
// makes reopening an upgraded database safe without a second migration marker.
export const migrateWorkspaceCapabilities = async (db: PGlite) => {
  await db.query(`UPDATE workspaces
    SET provider_capabilities_json = (provider_capabilities_json - 'archive') ||
      jsonb_build_object('delete', COALESCE(provider_capabilities_json -> 'delete', provider_capabilities_json -> 'archive', 'false'::jsonb))
    WHERE provider_capabilities_json ? 'archive'`);
};
