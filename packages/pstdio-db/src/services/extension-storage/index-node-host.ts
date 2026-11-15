import { sql } from "drizzle-orm";
import { extensionIdentityRenames } from "pstdio-api-contracts/extension-host";
import type { DbClient } from "../../db/connection.pglite";
import { projects, storage_documents, storage_ordered_owners } from "../../db/schemas.pg";
import { attachIndexNodeFiles, createIndexNodeFiles } from "./index-node-files";
import { type IndexNodeUpgradeProgress, upgradeIndexNodesToFiles } from "./index-node-upgrade";

const ownerId = (owner: { publisher: string; name: string }) => `${owner.publisher}.${owner.name}`;

/**
 * Attaches the host folder for encrypted index nodes, then brings it in line with the database:
 * renamed extension owners, the one-time move out of database rows, and removed projects.
 * Runs at startup after database migrations and before any storage service opens an owner.
 */
export const prepareIndexNodeFiles = async (
  db: DbClient,
  root: string,
  report?: (progress: IndexNodeUpgradeProgress | { compacted: true }) => void,
) => {
  const files = createIndexNodeFiles(root);
  attachIndexNodeFiles(db, files);
  for (const rename of extensionIdentityRenames) {
    const from = ownerId(rename.from);
    const to = ownerId(rename.to);
    // Follow the rows: a project whose identity migration was refused keeps its old owner.
    const moved = await db.execute(sql`SELECT DISTINCT workbench_id FROM ${storage_ordered_owners} o
      WHERE o.extension_id = ${to} AND NOT EXISTS (SELECT 1 FROM ${storage_documents} d
        WHERE d.workbench_id = o.workbench_id AND d.extension_id = ${from})`);
    for (const row of moved.rows) {
      const workbenchId = String(row.workbench_id);
      await files.moveOwner({ workbenchId, extensionId: from }, { workbenchId, extensionId: to });
    }
  }
  await upgradeIndexNodesToFiles(db, files, report);
  const ids = await db.select({ id: projects.id }).from(projects);
  await files.retainProjects(new Set(ids.map((row) => row.id)));
  return files;
};
