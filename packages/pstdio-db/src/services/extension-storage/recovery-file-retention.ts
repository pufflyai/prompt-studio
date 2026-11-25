import { eq } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { recovery_point_owners } from "../../db/schemas.pg";
import { recoveryFilesFor } from "./recovery-files";

/** Read references and collect while holding the same queue used by file writers.
 * Otherwise collection could remove a newly fsynced file before its row commits. */
export const pruneRecoveryProject = (db: DbClient, projectId: string) =>
  db.transaction(async (tx) => {
    const references = new Map<number, Set<string>>();
    const rows = await tx
      .select({ hours: recovery_point_owners.hours, sha256: recovery_point_owners.sha256 })
      .from(recovery_point_owners)
      .where(eq(recovery_point_owners.project_id, projectId));
    for (const row of rows) {
      const retained = references.get(row.hours) ?? new Set<string>();
      retained.add(row.sha256);
      references.set(row.hours, retained);
    }
    await recoveryFilesFor(db).retain(projectId, references);
  });

export const pruneRecoveryFiles = async (db: DbClient) => {
  for await (const projectId of recoveryFilesFor(db).projects()) await pruneRecoveryProject(db, projectId);
};
