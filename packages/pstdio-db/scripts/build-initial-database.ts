import { writeFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

export const buildInitialDatabase = async (destination: string) => {
  const db = await PGlite.create();
  try {
    const image = await db.dumpDataDir("gzip");
    await writeFile(destination, new Uint8Array(await image.arrayBuffer()));
  } finally {
    await db.close();
  }
};
