import { eq } from "drizzle-orm";
import { collectDocumentFiles } from "../services/extension-storage/document-file-retention";
import type { IndexNodeFiles } from "../services/extension-storage/index-node-files";
import { pruneRecoveryProject } from "../services/extension-storage/recovery-file-retention";
import { recoveryFilesFor } from "../services/extension-storage/recovery-files";
import type { DbClient } from "./connection.pglite";
import { projects } from "./schemas/projects";

/** Each yield releases the transaction queue. An interrupted idle pass keeps its
 * cursor until the next pass. Reopening starts a new sweep for crashed writers. */
export async function* collectUnreferencedFiles(db: DbClient, nodes: IndexNodeFiles) {
  for await (const id of recoveryFilesFor(db).projects()) {
    await pruneRecoveryProject(db, id);
    yield;
  }
  yield* collectDocumentFiles(db, undefined, 16);
  for (const id of await nodes.projectIds()) {
    // Project creation must not race a stale list of live project ids.
    await db.transaction(async (tx) => {
      const [live] = await tx.select({ id: projects.id }).from(projects).where(eq(projects.id, id));
      if (!live) await nodes.removeProject(id);
    });
    yield;
  }
}
