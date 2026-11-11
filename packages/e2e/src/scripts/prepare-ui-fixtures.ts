import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { uiFixtureExtensions } from "pstdio-scripts/testing";
import { preparePackagedExtensionSource } from "../packaged/packaged-extension-source";
import { copyPreparedFixtures } from "./prepared-fixture-copy";

export const preparedUiSourcesPath = (home: string) => join(home, "fixtures", "sources.json");

// Install public artifacts before the browser/server allowance. Runtime provisioning
// still performs a normal fresh install for every changed production consumer.
export const prepareUiFixtures = async (env: NodeJS.ProcessEnv, signal: AbortSignal) => {
  const installEnv = { ...env, HOME: env.E2E_HOME, BUN_INSTALL_CACHE_DIR: env.E2E_BUN_CACHE_DIR };
  const names = JSON.parse(env.E2E_FIXTURE_EXTENSIONS ?? JSON.stringify(uiFixtureExtensions)) as string[];
  const started = performance.now();
  const reused = env.E2E_PREPARED_FIXTURES
    ? copyPreparedFixtures(env.E2E_PREPARED_FIXTURES, env.E2E_HOME!, names)
    : undefined;
  const sources: Record<string, string> = reused?.sources ?? {};
  // Preparations share one Bun cache; finish each installer before starting the next.
  for (const name of names.filter((name) => !sources[name])) {
    sources[name] = await preparePackagedExtensionSource(
      join(env.E2E_HOME!, "fixtures", name),
      join(import.meta.dirname, "../../../../extensions", name),
      { env: installEnv, signal, install: true },
    );
  }
  env.E2E_EXTENSION_SOURCES = JSON.stringify(sources);
  if (env.CI_PLAN_FIXTURE_STATS)
    await writeFile(
      env.CI_PLAN_FIXTURE_STATS,
      JSON.stringify({
        planDigest: env.CI_PLAN_DIGEST,
        runId: env.CI_PLAN_RUN_ID,
        executionId: env.CI_TEST_EXECUTION_ID,
        names,
        complete: !signal.aborted,
        elapsedMs: performance.now() - started,
        reuseHits: reused?.reuseHits ?? 0,
        bytesCopied: reused?.bytesCopied ?? 0,
        copyMs: reused?.copyMs ?? 0,
      }),
    );
  // Node globalSetup and the server launcher do not share process.env mutations.
  await mkdir(join(env.E2E_HOME!, "fixtures"), { recursive: true });
  await writeFile(preparedUiSourcesPath(env.E2E_HOME!), env.E2E_EXTENSION_SOURCES);
};

if (import.meta.main) {
  const directory = process.argv[process.argv.indexOf("--out") + 1];
  const names = process.argv[process.argv.indexOf("--extensions") + 1];
  if (!directory || !names) throw new Error("Expected fixture output and extension selection");
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  try {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      E2E_PREPARED_FIXTURES: undefined,
      E2E_HOME: directory,
      E2E_FIXTURE_EXTENSIONS: names,
      E2E_BUN_CACHE_DIR: join(directory, "bun-cache"),
    };
    await prepareUiFixtures(env, controller.signal);
    await writeFile(join(directory, "sources.json"), env.E2E_EXTENSION_SOURCES!);
  } finally {
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
  }
}
