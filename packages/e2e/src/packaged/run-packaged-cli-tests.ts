import { PACKAGED_TEST_TIMEOUT } from "./packaged-test-timeout";

// Bun applies `setDefaultTimeout` from a preload only to the first test file, so the platform's
// limit is passed as `--timeout`, which covers every file. Extra arguments are forwarded.
const child = Bun.spawn(
  [
    process.execPath,
    `${import.meta.dir}/../../../../scripts/ci/run-bun-tests.ts`,
    "--preload",
    "./src/scripts/bun-process-cleanup.ts",
    "src/packaged",
    "--timeout",
    String(PACKAGED_TEST_TIMEOUT),
    "--silent",
    "--path-ignore-patterns=**/*.spec.ts",
    ...process.argv.slice(2),
  ],
  { cwd: `${import.meta.dir}/../..`, stdin: "inherit", stdout: "inherit", stderr: "inherit" },
);
process.exitCode = await child.exited;
