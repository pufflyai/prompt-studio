import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

export const buildInitialDatabase = async (destination: string) => {
  const db = await PGlite.create();
  try {
    await migrate(drizzle(db), { migrationsFolder: join(import.meta.dirname, "../drizzle") });
    const image = await db.dumpDataDir("gzip");
    await writeFile(destination, new Uint8Array(await image.arrayBuffer()));
  } finally {
    await db.close();
  }
};
