import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

export const buildInitialDatabase = async (destination: string) => {
  const db = await PGlite.create();
  try {
    await migrate(drizzle(db), { migrationsFolder: join(import.meta.dirname, "../drizzle") });
    // The runtime opens only template1. A first start writes every file in the image, which is slow
    // on Windows, and the two unused databases are over half of those files.
    await db.exec("DROP DATABASE postgres");
    await db.exec("ALTER DATABASE template0 IS_TEMPLATE false");
    await db.exec("DROP DATABASE template0");
    const image = await db.dumpDataDir("gzip");
    await writeFile(destination, new Uint8Array(await image.arrayBuffer()));
  } finally {
    await db.close();
  }
};
