import { join } from "node:path";
import { scaffoldBundledFiles } from "./scaffold-bundled-files";

const EMBEDDED_PLUGINS_PREFIX = "../files/plugins/pstdio/";

const stripTemplateSuffix = (filename: string) => {
  if (!filename.endsWith(".txt")) return filename;
  const stripped = filename.slice(0, -4);
  return stripped.includes(".") ? stripped : filename;
};

export const scaffoldBundledPlugins = async (repoPath: string, bundledPluginsDir: string) =>
  scaffoldBundledFiles(join(repoPath, ".pstdio", "plugins"), {
    bundledSourceDir: bundledPluginsDir,
    embeddedPrefix: EMBEDDED_PLUGINS_PREFIX,
    transformName: stripTemplateSuffix,
  });
