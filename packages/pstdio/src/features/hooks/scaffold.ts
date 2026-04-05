import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { resolveFilesRoot } from "../resolve-files-root";

const PLUGINS_DIR = join(".pstdio", "plugins");

export const stripTemplateSuffix = (filename: string) => {
  if (!filename.endsWith(".txt")) return filename;
  const stripped = filename.slice(0, -4);
  return stripped.includes(".") ? stripped : filename;
};

export const scaffoldPlugins = async (root: string) => {
  const pluginsDir = join(root, PLUGINS_DIR);
  if (existsSync(pluginsDir)) return;

  const filesRoot = await resolveFilesRoot();
  const defaultPluginsDir = join(filesRoot, "plugins", "pstdio");
  if (existsSync(defaultPluginsDir)) {
    mkdirSync(pluginsDir, { recursive: true });
    for (const entry of readdirSync(defaultPluginsDir)) {
      copyFileSync(join(defaultPluginsDir, entry), join(pluginsDir, stripTemplateSuffix(entry)));
    }
  }
};
