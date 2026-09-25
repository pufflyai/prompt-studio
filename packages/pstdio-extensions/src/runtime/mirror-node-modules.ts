import { existsSync, mkdirSync, readdirSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { mirrorPackageChild } from "./mirror-package-child";

export const mirrorNodeModules = (sourceNodeModulesPath: string, targetNodeModulesPath: string) => {
  if (!existsSync(sourceNodeModulesPath)) return;

  const sourceRoot = realpathSync(sourceNodeModulesPath);
  mkdirSync(targetNodeModulesPath, { recursive: true });
  for (const dirent of readdirSync(sourceRoot, { withFileTypes: true })) {
    const sourceChild = join(sourceRoot, dirent.name);
    const targetChild = join(targetNodeModulesPath, dirent.name);

    // Relative package links must resolve at their source, including inside scopes.
    // A junction above those links breaks Windows frontend builds (ADR 0031).
    if (dirent.name.startsWith("@")) {
      mirrorNodeModules(sourceChild, targetChild);
      continue;
    }

    mirrorPackageChild(sourceChild, targetChild);
  }
};
