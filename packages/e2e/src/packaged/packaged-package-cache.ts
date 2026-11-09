import { existsSync, mkdirSync, realpathSync, symlinkSync } from "node:fs";
import { dirname, join } from "node:path";

// The outer runner owns this prepared package cache until every runtime exits.
// Share package artifacts only; extensions still perform normal frozen installs
// into their own package-local node_modules, with independent homes and data.
export const stagePackagedPackageCache = (home: string, prepared = process.env.E2E_BUN_CACHE_DIR) => {
  const target = join(home, "cache", "extension-bun-install");
  if (!prepared || !existsSync(prepared) || existsSync(target)) return;
  mkdirSync(dirname(target), { recursive: true });
  symlinkSync(realpathSync(prepared), target, "junction");
};
