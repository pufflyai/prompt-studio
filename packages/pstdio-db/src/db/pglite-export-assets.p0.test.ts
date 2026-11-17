import { expect, test } from "bun:test";
import { join } from "node:path";
import { resolveExportWorker } from "./pglite-export-assets";

test.each([
  "../../pstdio-db/vendor/",
  "packages/pstdio-db/vendor/",
  "packages\\pstdio-db\\vendor\\",
])("extracts the database export worker from embedded assets under %s", async (prefix) => {
  const names = [
    "pglite-export-worker.js",
    "pglite-previous/pglite.wasm",
    "pglite-previous/pglite.data",
    "pglite/pglite.wasm",
    "pglite/pglite.data",
    "pglite/icu.76.tgz",
  ];
  const worker = await resolveExportWorker(names.map((name) => new File([name], `${prefix}${name}`)));
  try {
    expect(worker.assets).toBeDefined();
    expect(await Bun.file(worker.entry).text()).toBe("pglite-export-worker.js");
    expect(await Bun.file(join(worker.assets!, "pglite/pglite.wasm")).text()).toBe("pglite/pglite.wasm");
  } finally {
    await worker.dispose();
  }
});
