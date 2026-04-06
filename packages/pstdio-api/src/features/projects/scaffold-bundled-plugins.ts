import { join } from "node:path";
import { discoverPluginFiles } from "pstdio-plugins";
import { scaffoldBundledFiles } from "./scaffold-bundled-files";

const EMBEDDED_PLUGINS_PREFIX = "../files/plugins/pstdio/";

const stripTemplateSuffix = (filename: string) => {
  if (!filename.endsWith(".txt")) return filename;
  const stripped = filename.slice(0, -4);
  return stripped.includes(".") ? stripped : filename;
};

export const scaffoldBundledPlugins = async (repoPath: string, bundledPluginsDir: string) => {
  const pluginsDir = join(repoPath, ".pstdio", "plugins");

  await scaffoldBundledFiles(pluginsDir, {
    bundledSourceDir: bundledPluginsDir,
    embeddedPrefix: EMBEDDED_PLUGINS_PREFIX,
    transformName: stripTemplateSuffix,
    allowExistingTarget: discoverPluginFiles(pluginsDir).length === 0,
  });
};
