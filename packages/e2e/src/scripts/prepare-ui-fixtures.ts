import { execFile } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { preparePackagedExtensionSource } from "../packaged/packaged-extension-source";

const currentApiConsumers = [
  "extension-lab",
  "pstdio-session-browser",
  "pstdio-artifacts",
  "pstdio-home",
  "pstdio-planner",
];
export const preparedUiSourcesPath = (home: string) => join(home, "fixtures", "sources.json");

// Download through fresh public-package installs before the browser/server budget starts.
// Runtime provisioning still performs its normal install for every changed production consumer.
export const prepareUiFixtures = async (env: NodeJS.ProcessEnv, signal: AbortSignal) => {
  const installEnv = { ...env, HOME: env.E2E_HOME, BUN_INSTALL_CACHE_DIR: env.E2E_BUN_CACHE_DIR };
  const sources: Array<{ installName: string; source: string }> = [];
  // Each preparation mutates the shared Bun cache. Finish its normal fresh install
  // before starting the next, and own every installer until completion or cancellation.
  for (const installName of currentApiConsumers) {
    const source = await preparePackagedExtensionSource(
      join(env.E2E_HOME!, "fixtures", installName),
      join(import.meta.dirname, "../../../../extensions", installName),
      { env: installEnv, signal },
    );
    await promisify(execFile)(process.execPath, ["install", "--frozen-lockfile", "--ignore-scripts"], {
      cwd: source,
      env: installEnv,
      signal,
    });
    sources.push({ installName, source });
  }
  await writeFile(preparedUiSourcesPath(env.E2E_HOME!), JSON.stringify(sources));
};
