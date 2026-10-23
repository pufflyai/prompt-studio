import { cp, mkdir, readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { vendorPgliteAssets } from "./pglite-assets";

const require = createRequire(import.meta.url);
const packageRoot = (name: string) => dirname(require.resolve(`${name}/package.json`));

export const buildPgliteUpgradeAssets = async (directory: string) => {
  vendorPgliteAssets({
    vendorDir: join(directory, "pglite-previous"),
    pglitePackageDir: packageRoot("pglite-previous"),
  });
  const next = join(directory, "pglite");
  vendorPgliteAssets({ vendorDir: next, pglitePackageDir: packageRoot("@electric-sql/pglite") });
  const icu = join(next, "icu.76.tgz");
  // Preserve the package's actual data, rather than the default small ICU bundle.
  await cp(join(dirname(require.resolve("@electric-sql/pglite-icu-full")), "icu.76.tgz"), icu);
  const db = await PGlite.create({ database: "template1", username: "postgres" });
  try {
    await db.exec("drop database postgres");
    await db.exec("alter database template0 is_template false");
    await db.exec("drop database template0");
    await Bun.write(join(next, "empty-database.tar.gz"), await db.dumpDataDir("gzip"));
  } finally {
    await db.close();
  }
  // pgDump's public API resolves WASM relative to its published JS and cannot accept a module.
  // Keep that unmodified dependency external to the worker bundle, with its adjacent assets.
  const dumpSource = dirname(dirname(require.resolve("@electric-sql/pglite-tools/pg_dump")));
  const dumpTarget = join(directory, "pglite-tools");
  await mkdir(join(dumpTarget, "dist"), { recursive: true });
  await cp(join(dumpSource, "package.json"), join(dumpTarget, "package.json"));
  for (const file of await readdir(join(dumpSource, "dist"))) {
    if (file.endsWith(".js") || file.endsWith(".wasm")) {
      await cp(join(dumpSource, "dist", file), join(dumpTarget, "dist", file));
    }
  }
  const built = await Bun.build({
    entrypoints: [join(import.meta.dirname, "../src/db/pglite-upgrade-worker.ts")],
    target: "bun",
    plugins: [
      {
        name: "preserve-public-dump-module",
        setup(build) {
          build.onResolve({ filter: /^@electric-sql\/pglite-tools\/pg_dump$/ }, () => ({
            path: "./pglite-tools/dist/pg_dump.js",
            external: true,
          }));
        },
      },
    ],
  });
  if (!built.success) throw new AggregateError(built.logs, "Cannot build the isolated database transfer worker");
  await Bun.write(join(directory, "pglite-upgrade-worker.js"), built.outputs[0]);
};
