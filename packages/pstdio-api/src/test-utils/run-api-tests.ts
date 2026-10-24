import { rmSync } from "node:fs";
import { resolve } from "node:path";
import { runApiTestFiles } from "./api-test-scheduler";

const packageRoot = resolve(import.meta.dirname, "../..");
// CI splits the files across jobs with --shard=<index>/<count>, like `bun test --shard`.
const shard = process.argv.find((arg) => arg.startsWith("--shard="))?.slice("--shard=".length) ?? "1/1";
const [shardIndex = 1, shardCount = 1] = shard.split("/").map(Number);
const files = Array.from(new Bun.Glob("src/**/*.test.ts").scanSync({ cwd: packageRoot }))
  .sort()
  .filter((_, index) => index % shardCount === shardIndex - 1);
// Forward only coverage flags. Other callers pass their own --timeout, which would replace this runner's limit.
const coverageArgs = process.argv.slice(2).filter((arg) => arg.startsWith("--coverage"));
const coverage = coverageArgs.includes("--coverage");
let failures = 0;

// Each file writes its own lcov folder. Folders left by deleted test files would skew the total.
if (coverage) rmSync(resolve(packageRoot, "coverage"), { recursive: true, force: true });

// Each process owns one file's module state. See ADR 0018 for the Bun isolation limit.
const runFile = async (file: string) => {
  const index = files.indexOf(file);
  const coverageDir = coverage ? ["--coverage-dir", `coverage/${index}`] : [];
  const child = Bun.spawn(
    [
      process.execPath,
      "--no-orphans",
      "--conditions=source",
      resolve(packageRoot, "../../scripts/ci/run-bun-tests.ts"),
      "--conditions=source",
      `./${file}`,
      "--timeout",
      "30000",
      "--silent",
      ...coverageArgs,
      ...coverageDir,
    ],
    { cwd: packageRoot, stdin: "inherit", stdout: "inherit", stderr: "inherit" },
  );
  if ((await child.exited) !== 0) failures += 1;
};

await runApiTestFiles(files, runFile);
console.log(`API test files: ${files.length - failures} passed, ${failures} failed.`);
process.exitCode = failures === 0 ? 0 : 1;
