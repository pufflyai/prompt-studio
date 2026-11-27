import { join } from "node:path";
import { PGlite as CurrentPGlite } from "@electric-sql/pglite";
import { PGlite } from "pglite-previous";
import { exportDatabaseAsJson } from "./database-json-export";
import { fullIcuData } from "./icu-data";
import { pgliteIdentity } from "./pglite-identity";

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
      ...pgliteIdentity,
      pgliteWasmModule: options.wasmModule,
      fsBundle: options.fsBundle,
      ...(engine && { extensions: { fullIcuData: fullIcuData(Bun.file(join(engine, "icudt76l.dat.zst"))) } }),
    })
  : await PGlite.create(database, { ...pgliteIdentity, ...options });
try {
  await exportDatabaseAsJson(db, directory);
} finally {
  await db.close();
}
console.log(JSON.stringify({ completed: true }));
