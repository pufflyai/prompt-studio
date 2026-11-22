import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { pruneDocumentFiles } from "../../services/extension-storage/document-file-retention";
import { attachDocumentCollector, documentFilesFor } from "../../services/extension-storage/document-files";
import {
  attachIndexNodeFiles,
  createIndexNodeFiles,
  createMemoryIndexNodeFiles,
} from "../../services/extension-storage/index-node-files";
import { recoveryFilesFor } from "../../services/extension-storage/recovery-files";
import { resolvePgliteOptions } from "../connection.pglite";
import { attachDatabaseAuthority } from "../database-authority";
import { openPglite } from "../open-pglite";
import { engineFile, engineIdentity } from "../pglite-home-recovery";
import * as schema from "../schemas.pg";

/** Generated schema phase only: tests populate released inputs before explicit admission. */
export const createUnadmittedLegacyFixture = async (path = ":memory:") => {
  if (path !== ":memory:") await mkdir(path, { recursive: true });
  const pglite = await openPglite(path, await resolvePgliteOptions());
  await pglite.waitReady;
  const db = drizzle(pglite, { schema });
  try {
    await migrate(db, { migrationsFolder: join(import.meta.dirname, "../../../drizzle") });
    attachDatabaseAuthority(db, path);
    documentFilesFor(db, path);
    recoveryFilesFor(db, path);
    attachDocumentCollector(db, (project, ids) => pruneDocumentFiles(db, project, ids));
    attachIndexNodeFiles(
      db,
      path === ":memory:" ? createMemoryIndexNodeFiles() : createIndexNodeFiles(`${path}-index-nodes`),
    );
    if (path !== ":memory:") await writeFile(join(path, engineFile), JSON.stringify(engineIdentity));
    return { db, pglite, path, close: () => pglite.close(), cleanupRetiredRows: async () => {} };
  } catch (error) {
    await pglite.close();
    throw error;
  }
};
