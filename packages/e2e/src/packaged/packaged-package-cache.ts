import { constants, cpSync, existsSync } from "node:fs";
import { join } from "node:path";

// Packaged Bun deliberately owns a private cache under each runtime home. Seed
// that cache from this fixture run's prepared public artifacts, then let every
// extension perform its normal fresh, frozen package-local dependency install.
export const stagePackagedPackageCache = (home: string, prepared = process.env.E2E_BUN_CACHE_DIR) => {
  const target = join(home, "cache", "extension-bun-install");
  if (!prepared || !existsSync(prepared) || existsSync(target)) return;
  cpSync(prepared, target, { recursive: true, dereference: true, mode: constants.COPYFILE_FICLONE });
};
