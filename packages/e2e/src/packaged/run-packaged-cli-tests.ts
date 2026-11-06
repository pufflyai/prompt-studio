import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startLocalWorkspaceRegistry } from "../local-workspace-registry";
import { prepareUiFixtures } from "../scripts/prepare-ui-fixtures";
import { PACKAGED_TEST_TIMEOUT } from "./packaged-test-timeout";

const args = process.argv.slice(2);
const filesSelected = args.some((arg) => !arg.startsWith("-") && /\.test\.tsx?$/.test(arg));

// Bun applies `setDefaultTimeout` from a preload only to the first test file, so the platform's
// limit is passed as `--timeout`, which covers every file. Extra arguments are forwarded.
const root = mkdtempSync(join(tmpdir(), "pstdio-packaged-consumers-"));
const controller = new AbortController();
let child: ReturnType<typeof Bun.spawn> | undefined;
let registry: Awaited<ReturnType<typeof startLocalWorkspaceRegistry>> | undefined;
const forward = (signal: NodeJS.Signals) => {
  controller.abort(signal);
  child?.kill(signal);
};
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, forward);
try {
  const repoRoot = join(import.meta.dir, "../../../..");
  const npmConfigPath = join(root, ".npmrc");
  registry = await startLocalWorkspaceRegistry({
    configPath: npmConfigPath,
    outputRoot: join(root, "registry"),
    packagePaths: [join(repoRoot, "packages/sdk"), join(repoRoot, "packages/ui")],
  });
  const env = {
    ...process.env,
    E2E_HOME: join(root, "home"),
    E2E_BUN_CACHE_DIR: join(root, "bun-cache"),
    NPM_CONFIG_USERCONFIG: npmConfigPath,
  };
  // Reuse the maintained staged sources and fresh public-package installs. Every
  // test still provisions its own runtime/project; registry compatibility is separate.
  await prepareUiFixtures(env, controller.signal);
  controller.signal.throwIfAborted();
  child = Bun.spawn(
    [
      process.execPath,
      `${import.meta.dir}/../../../../scripts/ci/run-bun-tests.ts`,
      "--preload",
      "./src/scripts/bun-process-cleanup.ts",
      ...(filesSelected ? [] : ["src/packaged"]),
      "--timeout",
      String(PACKAGED_TEST_TIMEOUT),
      "--silent",
      "--path-ignore-patterns=**/*.spec.ts",
      ...args,
    ],
    { cwd: `${import.meta.dir}/../..`, env, stdin: "inherit", stdout: "inherit", stderr: "inherit" },
  );
  process.exitCode = await child.exited;
} finally {
  for (const signal of ["SIGINT", "SIGTERM"] as const) process.off(signal, forward);
  await registry?.close();
  await rm(root, { recursive: true, force: true });
}
