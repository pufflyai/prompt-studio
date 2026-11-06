import { constants, cpSync, existsSync, readdirSync, realpathSync, symlinkSync, unlinkSync } from "node:fs";
import { dirname, isAbsolute, join, relative, sep } from "node:path";

// Packaged Bun owns a private cache. Copy package artifacts once, retaining its
// cheap aliases but rebasing them so no runtime depends on the prepared cache.
export const stagePackagedPackageCache = (home: string, prepared = process.env.E2E_BUN_CACHE_DIR) => {
  const target = join(home, "cache", "extension-bun-install");
  if (!prepared || !existsSync(prepared) || existsSync(target)) return;
  const source = realpathSync(prepared);
  cpSync(source, target, { recursive: true, mode: constants.COPYFILE_FICLONE });
  const rebase = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) rebase(path);
      else if (entry.isSymbolicLink()) {
        const destination = relative(source, realpathSync(join(source, relative(target, path))));
        if (isAbsolute(destination) || destination === ".." || destination.startsWith(`..${sep}`))
          throw new Error("Prepared package cache alias leaves its owned cache.");
        unlinkSync(path);
        symlinkSync(relative(dirname(path), join(target, destination)), path);
      }
    }
  };
  rebase(target);
};
