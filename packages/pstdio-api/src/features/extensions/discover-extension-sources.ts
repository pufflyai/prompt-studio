import { existsSync } from "node:fs";
import { join } from "node:path";
import { discoverExtensionPackages, isPreparationHost } from "pstdio-extensions";
import { runExtensionPreparation } from "./extension-preparation";

export const listExtensionSourcesInWorker = (input: { root: string }) => ({
  rootExists: existsSync(input.root),
  paths: discoverExtensionPackages(input.root).filter((path) => !existsSync(join(path, ".pstdio-installing"))),
});
export const listExtensionSources = async (root: string) =>
  isPreparationHost
    ? runExtensionPreparation<ReturnType<typeof listExtensionSourcesInWorker>>("source.list", { root })
    : listExtensionSourcesInWorker({ root });
