import { join } from "node:path";
import { PGlite as CurrentPGlite } from "@electric-sql/pglite";
import { PGlite } from "pglite-previous";
import { exportDatabaseAsJson } from "./database-json-export";

// This worker only reads a home that startup is about to move aside. A home without an engine
// marker was written by the previous engine; a marked one by an earlier current-engine build.
const [database, directory, assets] = process.argv.slice(2);
if (!database || !directory) throw new Error("Expected database and export directories");
const marked = await Bun.file(join(database, ".pstdio-engine.json")).exists();
const engine = assets ? join(assets, marked ? "pglite" : "pglite-previous") : undefined;
const options = engine
  ? {
      wasmModule: await WebAssembly.compile(await Bun.file(join(engine, "pglite.wasm")).arrayBuffer()),
      fsBundle: Bun.file(join(engine, "pglite.data")),
    }
  : {};
const db = marked
  ? await CurrentPGlite.create(database, {
      pgliteWasmModule: options.wasmModule,
      fsBundle: options.fsBundle,
      ...(engine && { icuDataDir: Bun.file(join(engine, "icu.76.tgz")) }),
    })
  : await PGlite.create(database, options);
try {
  await exportDatabaseAsJson(db, directory);
} finally {
  await db.close();
}
console.log(JSON.stringify({ completed: true }));
