import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { createApiTestPlan } from "./api-test-plan";
import { runApiTestFiles } from "./api-test-scheduler";

const packageRoot = resolve(import.meta.dirname, "../..");
const root = resolve(packageRoot, "../..");
const args = process.argv.slice(2);
const option = (name: string) => {
  const paired = args.indexOf(name);
  if (paired >= 0 && (!args[paired + 1] || args[paired + 1]!.startsWith("--")))
    throw new Error(`Missing value for ${name}`);
  return paired >= 0 ? args[paired + 1] : args.find((arg) => arg.startsWith(`${name}=`))?.slice(name.length + 1);
};
const selectedJson = option("--files");
const selected: unknown = selectedJson === undefined ? undefined : JSON.parse(selectedJson);
if (selected !== undefined && (!Array.isArray(selected) || selected.some((file) => typeof file !== "string"))) {
  throw new Error("API --files must be a JSON array of package-relative test paths");
}
const timingFile = option("--timings");
const timingData = timingFile ? await Bun.file(timingFile).json() : undefined;
const plan = createApiTestPlan(Array.from(new Bun.Glob("src/**/*.test.{ts,tsx}").scanSync({ cwd: packageRoot })), {
  files: selected as string[] | undefined,
  shard: option("--shard"),
  timings: timingData?.files ?? timingData,
});
if (!plan.files.length) throw new Error(`API shard ${plan.shard} selected no test files`);
const priority = process.env.CI_PRIORITY ?? "P1";
if (!["P0", "P1", "P2", "P3"].includes(priority)) throw new Error(`Unknown test priority: ${priority}`);
// Only coverage flags are forwarded. The established API per-test limit stays at 30 seconds.
const coverageArgs = args.filter((arg) => arg.startsWith("--coverage"));
const coverage = coverageArgs.includes("--coverage");
if (coverage) rmSync(resolve(packageRoot, "coverage"), { recursive: true, force: true });
const directory = resolve(
  process.env.API_TEST_REPORT_DIR ??
    resolve(root, "test-results/ci/api", `${process.env.GITHUB_JOB ?? "local"}-${process.pid}`),
);
mkdirSync(directory, { recursive: true });
const controller = new AbortController();
const sigint = () => controller.abort("signal:SIGINT");
const sigterm = () => controller.abort("signal:SIGTERM");
process.once("SIGINT", sigint);
process.once("SIGTERM", sigterm);
const casesFor = (file: string) => resolve(directory, "files", String(plan.files.indexOf(file)), "cases.json");
const runFile = async (file: string, signal: AbortSignal) => {
  const index = plan.files.indexOf(file);
  // ADR 0018: each file owns one fresh process; the scheduler starts at most two.
  const child = Bun.spawn(
    [
      process.execPath,
      "--no-orphans",
      "--conditions=source",
      resolve(root, "scripts/ci/run-bun-tests.ts"),
      "--conditions=source",
      `./${file}`,
      "--timeout",
      "30000",
      "--silent",
      ...coverageArgs,
      ...(coverage ? ["--coverage-dir", `coverage/${index}`] : []),
    ],
    {
      cwd: packageRoot,
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
      env: {
        ...process.env,
        CI_PRIORITY: priority,
        BUN_TEST_EVIDENCE_FILE: casesFor(file),
        BUN_TEST_TIMINGS: resolve(directory, "files", String(index), "timings.json"),
      },
    },
  );
  const abort = () => child.kill();
  signal.addEventListener("abort", abort, { once: true });
  if (signal.aborted) abort();
  try {
    return await child.exited;
  } finally {
    signal.removeEventListener("abort", abort);
  }
};
try {
  await Bun.write(
    resolve(directory, "selected.json"),
    `${JSON.stringify({ ...plan, priority, selectionReason: selected ? "explicit PR regression files" : "all API files" }, null, 2)}\n`,
  );
  const results = await runApiTestFiles(plan.files, runFile, { priority, signal: controller.signal });
  const files = await Promise.all(
    results.map(async (result) => {
      const evidence = Bun.file(casesFor(result.file));
      if (await evidence.exists()) return { ...result, report: "present", cases: await evidence.json() };
      return { ...result, report: result.outcome === "cancelled" ? "cancelled" : "missing" };
    }),
  );
  const durations = Object.fromEntries(
    files
      .filter((result) => result.durationMs !== null && "cases" in result && result.cases.complete)
      .map((result) => [result.file, result.durationMs]),
  );
  await Bun.write(resolve(directory, "timings.json"), `${JSON.stringify({ version: 1, files: durations }, null, 2)}\n`);
  const complete = files.every((file) => file.outcome !== "cancelled" && "cases" in file && file.cases.complete);
  const passed = complete && files.every((file) => file.outcome === "success");
  await Bun.write(
    resolve(directory, "results.json"),
    `${JSON.stringify(
      {
        priority,
        sourceSha: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
        platform: process.platform,
        arch: process.arch,
        bun: Bun.version,
        ...plan,
        files,
        complete,
        outcome: passed ? "success" : "failure",
        cancellation: controller.signal.aborted ? String(controller.signal.reason) : null,
      },
      null,
      2,
    )}\n`,
  );
  const count = (outcome: string) => results.filter((result) => result.outcome === outcome).length;
  console.log(
    `API test files: ${count("success")} passed, ${count("failure")} failed, ${count("cancelled")} cancelled.`,
  );
  process.exitCode = passed ? 0 : 1;
} finally {
  process.removeListener("SIGINT", sigint);
  process.removeListener("SIGTERM", sigterm);
}
