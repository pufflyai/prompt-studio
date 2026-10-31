import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { createInstalledExtensionSourcesDBService } from "pstdio-db";
import { resolvePstdioHome } from "pstdio-paths";
import { EXTENSION_INSTALLING_MARKER } from "../extensions/install-extension-source";

export const getInstalledOnboardingSources = async (
  sources: Pick<ReturnType<typeof createInstalledExtensionSourcesDBService>, "list">,
) => {
  const root = resolve(resolvePstdioHome(), "extensions");
  return (await sources.list()).filter(
    (source) =>
      source.status === "loaded" &&
      dirname(resolve(source.source_path)) === root &&
      existsSync(source.source_path) &&
      !existsSync(join(source.source_path, EXTENSION_INSTALLING_MARKER)),
  );
};
