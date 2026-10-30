import { execFile } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";
import { preparePackagedExtensionSource } from "../packaged/packaged-extension-source";

// Functional UI cases use an installed public SDK fixture. Its dependency downloads
// belong to suite setup, before the browser server and the tested action begin.
export const prepareUiFixtures = async (env: NodeJS.ProcessEnv, signal: AbortSignal) => {
  const installEnv = { ...env, HOME: env.E2E_HOME, BUN_INSTALL_CACHE_DIR: env.E2E_BUN_CACHE_DIR };
  const source = await preparePackagedExtensionSource(
    join(env.E2E_HOME!, "fixtures", "lab"),
    join(import.meta.dirname, "../../../../extensions/extension-lab"),
    { env: installEnv, signal },
  );
  await promisify(execFile)(process.execPath, ["install", "--frozen-lockfile", "--ignore-scripts"], {
    cwd: source,
    env: installEnv,
    signal,
  });
  env.E2E_EXTENSION_LAB_SOURCE = source;
};
