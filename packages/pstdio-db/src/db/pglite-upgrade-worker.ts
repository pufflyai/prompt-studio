import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
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
  const require = createRequire(import.meta.url);
  const icu = engine
    ? join(engine, "icu.76.tgz")
    : join(dirname(require.resolve("@electric-sql/pglite-icu-full")), "icu.76.tgz");
  const db = await NextPGlite.create(database, {
    pgliteWasmModule: wasmModule,
    fsBundle,
    database: "template1",
    username: "postgres",
    icuDataDir: Bun.file(icu),
    loadDataDir: engine ? Bun.file(join(engine, "empty-database.tar.gz")) : undefined,
  });
  try {
    await importPgliteDatabase(db, archive);
  } finally {
    await db.close();
  }
}
console.log(JSON.stringify({ phase, completed: true }));
