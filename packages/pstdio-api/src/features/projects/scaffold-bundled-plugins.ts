import { join } from "node:path";
import { scaffoldBundledFiles } from "./scaffold-bundled-files";

const EMBEDDED_PLUGINS_PREFIX = "../files/plugins/pstdio/";

export const scaffoldBundledPlugins = async (repoPath: string, bundledPluginsDir: string) =>
  scaffoldBundledFiles(join(repoPath, ".pstdio", "plugins"), {
    bundledSourceDir: bundledPluginsDir,
    embeddedPrefix: EMBEDDED_PLUGINS_PREFIX,
  });
