import { cpSync, existsSync } from "node:fs";
import { join } from "node:path";

import { resolveFilesRoot } from "../resolve-files-root";

const PLUGINS_DIR = join(".pstdio", "plugins");

export const scaffoldPlugins = async (root: string) => {
  const pluginsDir = join(root, PLUGINS_DIR);
  if (existsSync(pluginsDir)) return;

  const filesRoot = await resolveFilesRoot();
  const defaultPluginsDir = join(filesRoot, "plugins", "pstdio");
  if (existsSync(defaultPluginsDir)) {
    cpSync(defaultPluginsDir, pluginsDir, { recursive: true });
  }
};
