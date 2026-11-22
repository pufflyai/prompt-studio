import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { retireLegacyRecordTables } from "../src/db/legacy-record-retirement";
import * as schema from "../src/db/schemas.pg";
import { startupImageInputs, startupImageManifest } from "../src/db/source-startup-image";

export const buildInitialDatabase = async (destination: string) => {
  const require = createRequire(import.meta.url);
  const icu = join(dirname(require.resolve("@electric-sql/pglite-icu-full")), "icu.76.tgz");
  const db = await PGlite.create({ database: "template1", username: "postgres", icuDataDir: Bun.file(icu) });
  const temporary = `${destination}.${crypto.randomUUID()}`;
  try {
    const connection = drizzle(db, { schema });
    const migrationsFolder = join(import.meta.dirname, "../drizzle");
    const inputs = await startupImageInputs(migrationsFolder);
    await migrate(connection, { migrationsFolder });
    await retireLegacyRecordTables(connection, migrationsFolder);
    // The runtime opens only template1. A first start writes every file in the image, which is slow
    // on Windows, and the two unused databases are over half of those files.
    await db.exec("DROP DATABASE postgres");
    await db.exec("ALTER DATABASE template0 IS_TEMPLATE false");
    await db.exec("DROP DATABASE template0");
    const image = new Uint8Array(await (await db.dumpDataDir("gzip")).arrayBuffer());
    const manifest = await startupImageManifest(image, migrationsFolder);
    if (manifest.inputs !== inputs) throw new Error("Migration inputs changed while building the startup image");
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(temporary, image);
    await writeFile(`${temporary}.json`, JSON.stringify(manifest));
    await rename(temporary, destination);
    await rename(`${temporary}.json`, `${destination}.json`);
  } finally {
    await db.close();
    await rm(temporary, { force: true });
    await rm(`${temporary}.json`, { force: true });
  }
};

if (import.meta.main) await buildInitialDatabase(join(import.meta.dirname, "../vendor/pglite/initial-database.tar.gz"));
