import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/pglite";
import { resolvePgliteOptions } from "./connection.pglite";
import { migratePglite } from "./migrate-pglite";
import { openPglite } from "./open-pglite";
import { engineFile, engineIdentity } from "./pglite-home-recovery";
import * as schema from "./schemas.pg";

/** Build the preceding schema from its unchanged generated migrations. */
export const createTextLogOwnerFixture = async (root: string, lastMigration = 10) => {
  const path = join(root, "database");
  const migrationsFolder = join(root, "prior-migrations");
  const source = join(import.meta.dirname, "../../drizzle-0.46");
  const journal = JSON.parse(await readFile(join(source, "meta/_journal.json"), "utf8"));
  journal.entries = journal.entries.filter((entry: { idx: number }) => entry.idx <= lastMigration);
  await mkdir(join(migrationsFolder, "meta"), { recursive: true });
  await writeFile(join(migrationsFolder, "meta/_journal.json"), JSON.stringify(journal));
  for (const entry of journal.entries)
    await copyFile(join(source, `${entry.tag}.sql`), join(migrationsFolder, `${entry.tag}.sql`));
  // Exercise the same cold archive loader as startup, retaining the bare engine
  // and every preceding generated migration inside the owning test's budget.
  await mkdir(path, { recursive: true });
  const pglite = await openPglite(path, await resolvePgliteOptions());
  await pglite.waitReady;
  const db = drizzle(pglite, { schema });
  try {
    await migratePglite(pglite, migrationsFolder);
    await writeFile(join(path, engineFile), JSON.stringify({ ...engineIdentity, baseline: "0.46" }));
  } catch (error) {
    await pglite.close();
    throw error;
  }
  return { path, pglite, db, close: () => pglite.close() };
};
