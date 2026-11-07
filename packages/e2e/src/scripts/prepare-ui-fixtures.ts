import { join } from "node:path";
import { preparePackagedExtensionSource } from "../packaged/packaged-extension-source";

// Functional UI cases use an installed public SDK fixture. Its dependency downloads
// belong to suite setup, before the browser server and the tested action begin.
export const prepareUiFixtures = async (env: NodeJS.ProcessEnv, signal: AbortSignal) => {
  const installEnv = { ...env, HOME: env.E2E_HOME, BUN_INSTALL_CACHE_DIR: env.E2E_BUN_CACHE_DIR };
  const sources = await Promise.all(
    ["extension-lab", "pstdio-planner", "pstdio-workspaces"].map(async (name) => {
      const started = performance.now();
      console.info(`[UI setup] Installing ${name}`);
      const source = await preparePackagedExtensionSource(
        join(env.E2E_HOME!, "fixtures", name),
        join(import.meta.dirname, "../../../../extensions", name),
        { env: installEnv, signal, install: true },
      );
      console.info(`[UI setup] Installed ${name} in ${Math.round(performance.now() - started)} ms`);
      return [name, source] as const;
    }),
  );
  env.E2E_EXTENSION_SOURCES = JSON.stringify(Object.fromEntries(sources));
};
