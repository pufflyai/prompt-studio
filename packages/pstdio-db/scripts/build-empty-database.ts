import { mkdir, rename, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

/** Engine asset only: application migrations and user data do not belong in this image. */
export const buildEmptyDatabase = async (destination: string) => {
  const db = await PGlite.create({ database: "template1", username: "postgres" });
  const temporary = `${destination}.${crypto.randomUUID()}`;
  try {
    await db.exec("drop database postgres");
    await db.exec("alter database template0 is_template false");
    await db.exec("drop database template0");
    await mkdir(dirname(destination), { recursive: true });
    await Bun.write(temporary, await db.dumpDataDir("gzip"));
    await rename(temporary, destination);
  } finally {
    await db.close();
    await rm(temporary, { force: true });
  }
};

if (import.meta.main) await buildEmptyDatabase(join(import.meta.dirname, "../vendor/pglite/empty-database.tar.gz"));
