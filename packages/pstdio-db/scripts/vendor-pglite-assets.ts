import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const PGLITE_ASSETS = ["pglite.wasm", "pglite.data"] as const;

export const vendorPgliteAssets = (options: {
  vendorDir: string;
  pglitePackageDir: string;
  logger?: (msg: string) => void;
}) => {
  const log = options.logger ?? (() => {});
  mkdirSync(options.vendorDir, { recursive: true });

  const results: { asset: string; src: string; dest: string; copied: boolean; size: number }[] = [];

  for (const asset of PGLITE_ASSETS) {
    const src = join(options.pglitePackageDir, "dist", asset);
    const dest = join(options.vendorDir, asset);

    if (!existsSync(src)) {
      throw new Error(`Expected PGlite asset is missing: ${src}`);
    }

    const srcStat = statSync(src);
    if (existsSync(dest)) {
      const destStat = statSync(dest);
      if (destStat.size === srcStat.size && destStat.mtimeMs >= srcStat.mtimeMs) {
        log(`[vendor-pglite] ${asset} up-to-date (${destStat.size} bytes)`);
        results.push({ asset, src, dest, copied: false, size: destStat.size });
        continue;
      }
    }

    copyFileSync(src, dest);
    log(`[vendor-pglite] copied ${asset} (${srcStat.size} bytes)`);
    results.push({ asset, src, dest, copied: true, size: srcStat.size });
  }

  return results;
};

export const resolvePglitePackageDir = () => {
  const require = createRequire(import.meta.url);
  return dirname(require.resolve("@electric-sql/pglite/package.json"));
};

if (Bun.main === import.meta.path) {
  const vendorDir = join(import.meta.dirname, "..", "vendor", "pglite");
  vendorPgliteAssets({
    vendorDir,
    pglitePackageDir: resolvePglitePackageDir(),
    logger: (msg) => console.log(msg),
  });
}
