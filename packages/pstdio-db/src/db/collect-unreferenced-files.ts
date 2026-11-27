import { basename, relative, sep } from "node:path";
import { and, eq, inArray } from "drizzle-orm";
import type { IndexNodeFiles } from "../services/extension-storage/index-node-files";
import { pruneRecoveryProject } from "../services/extension-storage/recovery-file-retention";
import { recoveryFilesFor } from "../services/extension-storage/recovery-files";
import type { DbClient } from "./connection.pglite";
import { idleFileBatches, removeIdleEntry } from "./idle-file-batches";
import { projects } from "./schemas/projects";
import { recovery_point_owners } from "./schemas/recovery-points";

/** Each yield releases the transaction queue. An interrupted idle pass keeps its
 * cursor until the next pass. Reopening starts a new sweep for crashed writers. */
export async function* collectUnreferencedFiles(db: DbClient, nodes: IndexNodeFiles) {
  const recovery = recoveryFilesFor(db);
  for await (const id of recovery.projects()) {
    const root = recovery.directory(id);
    if (!root) {
      await pruneRecoveryProject(db, id);
      yield;
      continue;
    }
    for await (const batch of idleFileBatches(root)) {
      await db.transaction(async (tx) => {
        const hashes = batch
          .map(({ path }) => basename(path, ".json.gz"))
          .filter((name) => /^[a-f0-9]{64}$/.test(name));
        const rows = hashes.length
          ? await tx
              .selectDistinct({ hours: recovery_point_owners.hours, sha: recovery_point_owners.sha256 })
              .from(recovery_point_owners)
              .where(and(eq(recovery_point_owners.project_id, id), inArray(recovery_point_owners.sha256, hashes)))
          : [];
        const retained = new Set(rows.map((row) => [String(row.hours), `${row.sha}.json.gz`].join(sep)));
        for (const entry of batch) if (!retained.has(relative(root, entry.path))) await removeIdleEntry(entry);
      });
      yield;
    }
  }
  for (const id of await nodes.projectIds()) {
    const liveProject = async (tx: Pick<DbClient, "select">) =>
      (await tx.select({ id: projects.id }).from(projects).where(eq(projects.id, id))).length !== 0;
    if (await liveProject(db)) {
      yield;
      continue;
    }
    const root = nodes.directory?.(id);
    if (!root) {
      await db.transaction(async (tx) => {
        if (!(await liveProject(tx))) await nodes.removeProject(id);
      });
      yield;
      continue;
    }
    for await (const batch of idleFileBatches(root)) {
      // A redownload can recreate this ID between batches. Stop before touching its files.
      const live = await db.transaction(async (tx) => {
        if (await liveProject(tx)) return true;
        for (const entry of batch) await removeIdleEntry(entry);
        return false;
      });
      yield;
      if (live) break;
    }
  }
}
