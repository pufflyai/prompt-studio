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
  const preparations = await Promise.allSettled(
    currentApiConsumers.map(async (installName) => {
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
      return { installName, source };
    }),
  );
  // Preparation owns child installers until every one settles, including on failure/abort.
  // The caller removes the run folder immediately after this function returns.
  const failures = preparations.flatMap((result) => (result.status === "rejected" ? [result.reason] : []));
  if (failures.length) throw new AggregateError(failures, "UI fixture preparation failed.");
  const sources = preparations.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
  await writeFile(preparedUiSourcesPath(env.E2E_HOME!), JSON.stringify(sources));
};
