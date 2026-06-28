import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";

const COLLECTIONS_TO_DROP = ["workspace-status-definitions", "workspace-status-values"] as const;
const LEGACY_INITIALIZED_KEY = "workspace-status-definitions-initialized";
const MIGRATION_MARKER = "__pstdio-planner:workspace-status-cleanup-applied";

// PS-94 removes the stored workspace-status surface in favour of the live
// `workspace-activity` probe. This migration is idempotent: the marker stops
// it from re-running once every legacy row is gone.
export const dropWorkspaceStatusCollections = async (storage: ExtensionStorageApi) => {
  if (await storage.get(MIGRATION_MARKER)) return { dropped: 0 };

  let dropped = 0;
  for (const collectionName of COLLECTIONS_TO_DROP) {
    const collection = storage.collection(collectionName);
    const rows = (await collection.list()) as Array<{ id?: string; workspaceId?: string }>;
    for (const row of rows) {
      const id = row.id ?? row.workspaceId;
      if (!id) continue;
      await collection.delete(id);
      dropped += 1;
    }
  }
  await storage.delete(LEGACY_INITIALIZED_KEY);
  await storage.set(MIGRATION_MARKER, true);
  return { dropped };
};
