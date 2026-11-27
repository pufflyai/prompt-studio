import { inArray } from "drizzle-orm";
import { extensionIdentityRenames } from "pstdio-api-contracts/extension-host";
import type { StorageOwner } from "pstdio-sync";
import { migrateExtensionIdentities, moveRenamedIndexNodes } from "../services/extension-identity-migration";
import type { IndexNodeFiles } from "../services/extension-storage/index-node-files";
import { upgradeIndexNodesToFiles } from "../services/extension-storage/index-node-upgrade";
import { artifactProjectionRefusals, restoreArtifactProjectionAdmission } from "./artifact-projection-admission";
import type { DbClient, DbOpenPhase } from "./connection.pglite";
import * as schema from "./schemas.pg";
import { invalidateMaintenance } from "./startup-maintenance";
import { unadmittedStorageOwners } from "./storage-admission";

// A matching clean checkpoint already covers receipt conversion, owner renames
// and mirror admission. Otherwise re-run each step before exposing that storage.
export const admitStorageFiles = async ({
  db,
  dbPath,
  indexNodes,
  deferCleanup,
  onPhase,
  current,
  finishArtifactProjectionUpgrade,
}: {
  db: DbClient;
  dbPath: string;
  indexNodes: IndexNodeFiles;
  deferCleanup: boolean;
  onPhase: (phase: DbOpenPhase) => void;
  current: boolean;
  finishArtifactProjectionUpgrade?: () => Promise<void>;
}) => {
  const deferredOwners: StorageOwner[] = [];
  if (current) {
    // The external receipt tree can be restored independently of pg_control.
    await moveRenamedIndexNodes(db, extensionIdentityRenames);
    return { complete: true, changed: false, deferredOwners };
  }
  const owed = () => invalidateMaintenance(dbPath);
  let complete = true;
  onPhase("database_index_nodes");
  const renamedOwners = new Set(
    extensionIdentityRenames.flatMap(({ from, to }) => [
      `${from.publisher}.${from.name}`,
      `${to.publisher}.${to.name}`,
    ]),
  );
  const movedNodes = await upgradeIndexNodesToFiles(
    db,
    indexNodes,
    undefined,
    owed,
    (owner) => {
      if (!deferCleanup || renamedOwners.has(owner.extensionId)) return false;
      deferredOwners.push(owner);
      return true;
    },
    () => {
      complete = false;
    },
  );
  const renamed = await migrateExtensionIdentities(db, {
    beforeChange: owed,
    onConflict: async (error) => {
      complete = false;
      await db
        .update(schema.installed_extension_sources)
        .set({ status: "error", last_error_json: { code: error.code, message: error.message } })
        .where(inArray(schema.installed_extension_sources.extension_id, [error.from, error.to]));
    },
  });
  await finishArtifactProjectionUpgrade?.();
  await restoreArtifactProjectionAdmission(db, dbPath);
  return {
    deferredOwners,
    changed: movedNodes || renamed,
    complete:
      complete && !deferredOwners.length && !unadmittedStorageOwners(db).length && !artifactProjectionRefusals(db),
  };
};
