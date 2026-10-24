import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { PGlite as NextPGlite } from "@electric-sql/pglite";
import { PGlite } from "pglite-previous";
import { exportPgliteDatabase, importPgliteDatabase } from "./pglite-transfer";

// This worker only transforms private copies. Active-home ownership stays with createDb.
const [phase, database, archive, assets] = process.argv.slice(2);
if (!database || !archive || (phase !== "export" && phase !== "import")) {
  throw new Error("Expected transfer phase, private database, archive and asset directories");
}
const engine = assets ? join(assets, phase === "export" ? "pglite-previous" : "pglite") : undefined;
const wasmModule = engine
  ? await WebAssembly.compile(await Bun.file(join(engine, "pglite.wasm")).arrayBuffer())
  : undefined;
const fsBundle = engine ? Bun.file(join(engine, "pglite.data")) : undefined;
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
  // The previous engine cannot create ICU collations. Transfer its C/libc schema
  // in this engine directly; only the final active runtime needs full locale data.
  const db = await NextPGlite.create(database, {
    pgliteWasmModule: wasmModule,
    fsBundle,
    database: "template1",
    username: "postgres",
    loadDataDir: Bun.file(join(engine ?? join(import.meta.dirname, "../../vendor/pglite"), "empty-database.tar.gz")),
  });
  try {
    await importPgliteDatabase(db, archive);
  } finally {
    await db.close();
  }
}
console.log(JSON.stringify({ phase, completed: true }));
