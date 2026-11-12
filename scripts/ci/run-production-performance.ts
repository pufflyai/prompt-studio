import { cpSync, existsSync, mkdirSync } from "node:fs";
import { cpus, platform, release, totalmem } from "node:os";
import { join, resolve } from "node:path";
import { captureOrderedPerformanceReport } from "./ordered-performance-reports";
import { performanceChecks } from "./production-performance-profile";
import { runCiChecks } from "./run-ci-checks";

const [family, evidence] = process.argv.slice(2);
if (!family || !evidence) throw new Error("Expected performance family and evidence directory");
const checks = performanceChecks(family);
const directory = resolve(`test-results/production-performance/${family}`);
mkdirSync(directory, { recursive: true });
if (family === "storage" || family === "runtime") await Bun.write(join(directory, `${family}.jsonl`), "");
const identity = {
  planDigest: process.env.CI_PLAN_DIGEST,
  runId: process.env.CI_PLAN_RUN_ID,
  executionId: process.env.CI_TEST_EXECUTION_ID,
};
await Bun.write(
  join(directory, "metadata.json"),
  JSON.stringify(
    {
      ...identity,
      sourceSha: process.env.SOURCE_SHA ?? process.env.CI_PLAN_SOURCE_SHA,
      versionSha: process.env.CI_PLAN_SOURCE_SHA,
      platform: platform(),
      release: release(),
      arch: process.arch,
      cpu: cpus()[0]?.model,
      memory: totalmem(),
      bun: Bun.version,
      trace: "off",
      checks,
      measurementPolicy: "Use registered benchmark workloads and existing operation budgets unchanged",
    },
    null,
    2,
  ),
);
const results = [];
const controller = new AbortController();
const stop = () => controller.abort();
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
let passed = true;
let cleanedUp = true;
for (const check of checks) {
  const report = await runCiChecks([check], {
    priority: "P3",
    signal: controller.signal,
    concurrency: 1,
    inheritProcessGroup: true,
    logDirectory: join(directory, "logs"),
    env: {
      SUBNAV_LABEL: process.env.CI_PLAN_SOURCE_SHA,
      CI_PLAN_BROWSER_EVIDENCE: join(directory, `${check.id}-cases.json`),
    },
  });
  captureOrderedPerformanceReport(process.cwd(), directory, check.id);
  results.push(...report.results);
  passed &&= report.outcome === "success";
  cleanedUp &&= !report.cleanupFailures?.length;
}
if (family === "navigation") {
  const raw = join("__test-tmp__/subnav-benchmark/results", process.env.CI_PLAN_SOURCE_SHA!);
  if (existsSync(raw)) cpSync(raw, join(directory, "performance/subnav"), { recursive: true });
}
const complete =
  results.length === checks.length &&
  results.every((result) => result.exitCode !== null) &&
  cleanedUp &&
  !controller.signal.aborted;
const outcome = passed ? "success" : "failure";
await Bun.write(join(directory, "results.json"), JSON.stringify({ ...identity, complete, outcome, results }, null, 2));
cpSync(directory, join(evidence, "production-performance"), { recursive: true });
process.exitCode = complete && outcome === "success" ? 0 : 1;
