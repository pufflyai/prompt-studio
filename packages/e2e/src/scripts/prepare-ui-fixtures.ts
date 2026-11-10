import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { preparePackagedExtensionSource } from "../packaged/packaged-extension-source";

const currentApiConsumers = [
  "extension-lab",
  "pstdio-session-browser",
  "pstdio-artifacts",
  "pstdio-cloud",
  "pstdio-home",
  "pstdio-performance",
  "pstdio-planner",
  "pstdio-workspaces",
];
export const preparedUiSourcesPath = (home: string) => join(home, "fixtures", "sources.json");

// Install public artifacts before the browser/server allowance. Runtime provisioning
// still performs a normal fresh install for every changed production consumer.
export const prepareUiFixtures = async (env: NodeJS.ProcessEnv, signal: AbortSignal) => {
  const installEnv = { ...env, HOME: env.E2E_HOME, BUN_INSTALL_CACHE_DIR: env.E2E_BUN_CACHE_DIR };
  const sources: Record<string, string> = {};
  // Preparations share one Bun cache; finish each installer before starting the next.
  for (const name of currentApiConsumers) {
    sources[name] = await preparePackagedExtensionSource(
      join(env.E2E_HOME!, "fixtures", name),
      join(import.meta.dirname, "../../../../extensions", name),
      { env: installEnv, signal, install: true },
    );
  }
  env.E2E_EXTENSION_SOURCES = JSON.stringify(sources);
  // Node globalSetup and the server launcher do not share process.env mutations.
  await writeFile(preparedUiSourcesPath(env.E2E_HOME!), env.E2E_EXTENSION_SOURCES);
};
