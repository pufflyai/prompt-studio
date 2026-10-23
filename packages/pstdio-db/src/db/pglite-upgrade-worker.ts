import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { PGlite as NextPGlite } from "pglite-next";
import { exportPgliteDatabase, importPgliteDatabase } from "./pglite-transfer";

// This worker only transforms private copies. Active-home ownership stays with createDb.
const [phase, database, archive, assets] = process.argv.slice(2);
if (!database || !archive || !assets || (phase !== "export" && phase !== "import")) {
  throw new Error("Expected transfer phase, private database, archive and asset directories");
}
const engine = join(assets, phase === "export" ? "pglite" : "pglite-next");
const wasmModule = await WebAssembly.compile(await Bun.file(join(engine, "pglite.wasm")).arrayBuffer());
const fsBundle = Bun.file(join(engine, "pglite.data"));
if (phase === "export") {
  await mkdir(archive);
  const db = await PGlite.create(database, { wasmModule, fsBundle });
  try {
    await exportPgliteDatabase(db, archive);
  } finally {
    await db.close();
  }
} else {
  await mkdir(database);
  const db = await NextPGlite.create(database, {
    pgliteWasmModule: wasmModule,
    fsBundle,
    database: "template1",
    username: "postgres",
    icuDataDir: Bun.file(join(engine, "icu.76.tgz")),
    loadDataDir: Bun.file(join(engine, "empty-database.tar.gz")),
  });
  try {
    await importPgliteDatabase(db, archive);
  } finally {
    await db.close();
  }
}
console.log(JSON.stringify({ phase, completed: true }));
