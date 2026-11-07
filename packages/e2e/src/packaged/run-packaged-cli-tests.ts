import { PACKAGED_TEST_TIMEOUT } from "./packaged-test-timeout";
import { preparePackagedConsumers } from "./prepared-packaged-consumers";

const args = process.argv.slice(2);
const filesSelected = args.some((arg) => !arg.startsWith("-") && /\.test\.tsx?$/.test(arg));

// Bun applies `setDefaultTimeout` from a preload only to the first test file, so the platform's
// limit is passed as `--timeout`, which covers every file. Extra arguments are forwarded.
const controller = new AbortController();
let child: ReturnType<typeof Bun.spawn> | undefined;
let profile: Awaited<ReturnType<typeof preparePackagedConsumers>> | undefined;
const forward = (signal: NodeJS.Signals) => {
  controller.abort(signal);
  child?.kill(signal);
};
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, forward);
try {
  // Reuse the maintained staged sources and fresh public-package installs. Every
  // test still provisions its own runtime/project; registry compatibility is separate.
  profile = await preparePackagedConsumers(controller.signal);
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
    { cwd: `${import.meta.dir}/../..`, env: profile.env, stdin: "inherit", stdout: "inherit", stderr: "inherit" },
  );
  process.exitCode = await child.exited;
} finally {
  for (const signal of ["SIGINT", "SIGTERM"] as const) process.off(signal, forward);
  await profile?.close();
}
