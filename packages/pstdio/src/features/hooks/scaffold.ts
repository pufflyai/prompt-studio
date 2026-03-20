import { cpSync, existsSync } from "node:fs";
import { join } from "node:path";

import { resolveFilesRoot } from "../resolve-files-root";

const HOOKS_DIR = join(".pstdio", "hooks");

export const scaffoldHooks = async (root: string) => {
  const hooksDir = join(root, HOOKS_DIR);
  if (existsSync(hooksDir)) return;

  const filesRoot = await resolveFilesRoot();
  const sourceDir = join(filesRoot, "hooks");
  if (!existsSync(sourceDir)) return;

  cpSync(sourceDir, hooksDir, { recursive: true });
};
