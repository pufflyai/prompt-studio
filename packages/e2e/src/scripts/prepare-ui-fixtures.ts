import { execFile } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { uiFixtureExtensions } from "pstdio-scripts/testing";
import { preparePackagedExtensionSource, preparePackagedPackageArtifacts } from "../packaged/packaged-extension-source";
import { copyPreparedFixtures } from "./prepared-fixture-copy";

export const preparedUiSourcesPath = (home: string) => join(home, "fixtures", "sources.json");

// One execution prepares sources, public tarballs and package payloads. Borrowers
// copy only source; each timed runtime still installs its own dependencies.
const prepareFixtures = async (
  env: NodeJS.ProcessEnv,
  signal: AbortSignal,
  packageArtifacts?: Readonly<Record<string, string>>,
) => {
  const names = JSON.parse(env.E2E_FIXTURE_EXTENSIONS ?? JSON.stringify(uiFixtureExtensions)) as string[];
  const started = performance.now();
  const reused = env.E2E_PREPARED_FIXTURES
    ? copyPreparedFixtures(env.E2E_PREPARED_FIXTURES, env.E2E_HOME!, names)
    : undefined;
  if (reused) env.E2E_BUN_CACHE_DIR = reused.packageCache;
  await mkdir(env.E2E_BUN_CACHE_DIR!, { recursive: true });
  const installEnv = { ...env, HOME: env.E2E_HOME, BUN_INSTALL_CACHE_DIR: env.E2E_BUN_CACHE_DIR };
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
    if (!reused)
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
) => prepareFixtures(env, signal, packageArtifacts);

if (import.meta.main) {
  const directory = process.argv[process.argv.indexOf("--out") + 1];
  const names = process.argv[process.argv.indexOf("--extensions") + 1];
  if (!directory || !names) throw new Error("Expected fixture output and extension selection");
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  try {
    await rm(join(directory, "sources.json"), { force: true });
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      E2E_PREPARED_FIXTURES: undefined,
      E2E_HOME: directory,
      E2E_FIXTURE_EXTENSIONS: names,
      E2E_BUN_CACHE_DIR: join(directory, "bun-cache"),
    };
    await prepareUiFixtures(env, controller.signal);
    const sources = JSON.parse(env.E2E_EXTENSION_SOURCES!) as Record<string, string>;
    // Only package payloads are borrowed. Discard disposable setup installs before
    // publishing the handoff, so partial preparation is never reusable.
    for (const source of Object.values(sources))
      await rm(join(source, "node_modules"), { recursive: true, force: true });
    controller.signal.throwIfAborted();
    await writeFile(join(directory, "sources.json"), JSON.stringify({ sources, packageCache: env.E2E_BUN_CACHE_DIR }));
  } finally {
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
  }
}
