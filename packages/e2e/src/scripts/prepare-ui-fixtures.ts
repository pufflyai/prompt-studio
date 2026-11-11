import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { uiFixtureExtensions } from "pstdio-scripts/testing";
import { preparePackagedExtensionSource, preparePackagedPackageArtifacts } from "../packaged/packaged-extension-source";
import { copyPreparedFixtures } from "./prepared-fixture-copy";

export const preparedUiSourcesPath = (home: string) => join(home, "fixtures", "sources.json");

// Producers retain immutable source and tarballs. Consumers also prepare their private
// package cache, which timed runtime installs already used before source reuse.
const prepareFixtures = async (
  env: NodeJS.ProcessEnv,
  signal: AbortSignal,
  install: boolean,
  packageArtifacts?: Readonly<Record<string, string>>,
) => {
  const installEnv = { ...env, HOME: env.E2E_HOME, BUN_INSTALL_CACHE_DIR: env.E2E_BUN_CACHE_DIR };
  const names = JSON.parse(env.E2E_FIXTURE_EXTENSIONS ?? JSON.stringify(uiFixtureExtensions)) as string[];
  const started = performance.now();
  const reused = env.E2E_PREPARED_FIXTURES
    ? copyPreparedFixtures(env.E2E_PREPARED_FIXTURES, env.E2E_HOME!, names)
    : undefined;
  const sources: Record<string, string> = reused?.sources ?? {};
  const artifacts =
    packageArtifacts ??
    (names.some((name) => !sources[name])
      ? preparePackagedPackageArtifacts(join(env.E2E_HOME!, "fixtures", "packages"))
      : undefined);
  // Preparations share one Bun cache; finish each installer before starting the next.
  for (const name of names) {
    if (!sources[name])
      sources[name] = await preparePackagedExtensionSource(
        join(env.E2E_HOME!, "fixtures", name),
        join(import.meta.dirname, "../../../../extensions", name),
        { env: installEnv, signal, packageArtifacts: artifacts },
      );
    if (install)
      await promisify(execFile)("bun", ["install", "--frozen-lockfile", "--ignore-scripts"], {
        cwd: sources[name],
        env: installEnv,
        signal,
      });
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

export const prepareUiFixtures = (
  env: NodeJS.ProcessEnv,
  signal: AbortSignal,
  packageArtifacts?: Readonly<Record<string, string>>,
) => prepareFixtures(env, signal, true, packageArtifacts);

export const prepareUiFixtureSources = (env: NodeJS.ProcessEnv, signal: AbortSignal) =>
  prepareFixtures(env, signal, false);

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
    await prepareUiFixtureSources(env, controller.signal);
    await writeFile(join(directory, "sources.json"), env.E2E_EXTENSION_SOURCES!);
  } finally {
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
  }
}
