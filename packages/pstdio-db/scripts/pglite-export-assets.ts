import { rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { packIcu } from "./pack-icu";
import { vendorPgliteAssets } from "./pglite-assets";

const require = createRequire(import.meta.url);
const packageRoot = (name: string) => dirname(require.resolve(`${name}/package.json`));

export const buildPgliteExportAssets = async (directory: string) => {
  vendorPgliteAssets({
    vendorDir: join(directory, "pglite-previous"),
    pglitePackageDir: packageRoot("pglite-previous"),
  });
  const current = join(directory, "pglite");
  vendorPgliteAssets({ vendorDir: current, pglitePackageDir: packageRoot("@electric-sql/pglite") });
  // Preserve the package's actual data, rather than the default small ICU bundle.
  const archive = Bun.file(join(dirname(require.resolve("@electric-sql/pglite-icu-full")), "icu.76.tgz"));
  await Bun.write(join(current, "icudt76l.dat.zst"), await packIcu(archive));
  await rm(join(current, "icu.76.tgz"), { force: true });
  const built = await Bun.build({
    entrypoints: [join(import.meta.dirname, "../src/db/pglite-export-worker.ts")],
    target: "bun",
  });
  if (!built.success) throw new AggregateError(built.logs, "Cannot build the isolated database export worker");
  await Bun.write(join(directory, "pglite-export-worker.js"), built.outputs[0]);
};
