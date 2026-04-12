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

  console.error(`[CI-DEBUG]     pluginsDir=${pluginsDir} bundledPluginsDir=${bundledPluginsDir}`);
  const startDiscover = Date.now();
  const discovered = discoverPluginFiles(pluginsDir);
  console.error(`[CI-DEBUG]     discoverPluginFiles → ${discovered.length} files in ${Date.now() - startDiscover}ms`);

  const startScaffold = Date.now();
  console.error(`[CI-DEBUG]     >>> scaffoldBundledFiles`);
  await scaffoldBundledFiles(pluginsDir, {
    bundledSourceDir: bundledPluginsDir,
    embeddedPrefix: EMBEDDED_PLUGINS_PREFIX,
    transformName: stripTemplateSuffix,
    allowExistingTarget: discovered.length === 0,
  });
  console.error(`[CI-DEBUG]     <<< scaffoldBundledFiles OK ${Date.now() - startScaffold}ms`);
};
