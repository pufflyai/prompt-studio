import { join } from "node:path";
import { buildInitialDatabase } from "./build-initial-database";
import { resolvePglitePackageDir, vendorPgliteAssets } from "./pglite-assets";
import { buildPgliteExportAssets } from "./pglite-export-assets";

export { resolvePglitePackageDir, vendorPgliteAssets } from "./pglite-assets";

if (Bun.main === import.meta.path) {
  const vendorRoot = join(import.meta.dirname, "..", "vendor");
  const vendorDir = join(vendorRoot, "pglite");
  vendorPgliteAssets({ vendorDir, pglitePackageDir: resolvePglitePackageDir(), logger: console.log });
  await buildInitialDatabase(join(vendorDir, "initial-database.tar.gz"));
  await buildPgliteExportAssets(vendorRoot);
  console.log("[vendor-pglite] generated current startup and isolated export assets");
}
