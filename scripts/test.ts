import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { changedFiles } from "./ci/changed-files";
import { createCiTestPlan } from "./ci/ci-test-plan";
import { createProductionPerformancePlan } from "./ci/production-performance-plan";
import { resolveCiScope } from "./ci/pull-request-ci-scope";
import { requestedTestFiles } from "./ci/requested-test-files";
import { executePlan } from "./ci/run-test-plan";
import { discoverTestFiles, priorityFromFile, testPriorities, testRunner } from "./ci/test-discovery";
import { parseTestOptions, resolveTestFile } from "./ci/test-options";
import { createTestPlan, type TestPlan } from "./ci/test-plan";
import { testPlanSource } from "./ci/test-plan-source";
import { matchesPlatform, quarantineRegistry, quarantineRunnerForTest } from "./ci/test-quarantine";
import { createTestRuns } from "./ci/test-runs";
import { selectLocalTests } from "./ci/test-selection";
import { readTestTimingSnapshot } from "./ci/test-timing-snapshot";
import { readWorkspacePackages } from "./ci/workspace-packages";

const root = resolve(import.meta.dir, "..");
const { args, files: positionalFiles } = parseTestOptions(process.argv.slice(2));
const values = (flag: string) => args.flatMap((arg, index) => (arg === flag ? [args[index + 1]!] : []));
const value = (flag: string) => {
  const index = args.indexOf(flag);
  if (index < 0) return;
  const item = args[index + 1];
  if (!item || item.startsWith("--")) throw new Error(`Missing value for ${flag}`);
  return item;
};
const lane = value("--lane");
if (lane && !["all", "stable", "quarantine"].includes(lane)) throw new Error("Unknown test lane");
const readPlan = value("--plan");
let plan: TestPlan;
const performanceFamily = value("--performance-family");
if (performanceFamily) {
  plan = createProductionPerformancePlan(
    performanceFamily,
    testPlanSource(root),
    { platform: process.platform, arch: process.arch },
    process.env.SOURCE_SHA,
  );
} else if (readPlan) {
  if (positionalFiles.length) throw new Error("Saved plans use their assigned run IDs");
  plan = JSON.parse(readFileSync(resolve(readPlan), "utf8"));
} else {
  const source = testPlanSource(root);
  const timingSnapshot = value("--timings") ? readTestTimingSnapshot(resolve(value("--timings")!), root) : undefined;
  const coverage = process.env.CI_SOURCE_COVERAGE === "1";
  const packages = readWorkspacePackages(root).map((pkg) => ({
    ...pkg,
    scripts: JSON.parse(readFileSync(join(root, pkg.dir, "package.json"), "utf8")).scripts ?? {},
  }));
  const tests = discoverTestFiles(root);
  const stage = value("--stage");
  if (stage && !["pull_request", "main", "merge_queue", "nightly", "stable", "full"].includes(stage))
    throw new Error("Unknown CI stage");
  const event = stage === "main" ? "push" : "merge_group";
  if (stage || args.includes("--changed")) {
    const scope = resolveCiScope({
      event: stage === "pull_request" || !stage ? "pull_request" : event,
      profile: ["full", "nightly", "stable"].includes(stage ?? "") ? "production" : undefined,
      releaseChannel: stage === "nightly" ? "nightly" : "stable",
      changedFiles: changedFiles(root, value("--base")),
      packages,
      tests,
      timingSnapshot,
      coverage,
    });
    plan = createCiTestPlan(scope, packages, tests, source, undefined, timingSnapshot);
  } else {
    const requested = [...values("--file"), ...positionalFiles].map((file) =>
      resolveTestFile(file, root, process.cwd(), tests),
    );
    const inferred =
      requested.length && requested.every((file) => tests.includes(file))
        ? [...new Set(requested.map((file) => priorityFromFile(file)))].join(",")
        : "P0,P1,P2";
    const artifact = value("--artifact");
    if (artifact && !["compiled-cli", "packaged-desktop", "source"].includes(artifact))
      throw new Error("Unknown test artifact");
    const priorities = (value("--priority") ?? inferred).toUpperCase().split(",");
    if (priorities.some((p) => !testPriorities.includes(p as "P0"))) throw new Error("Choose p0, p1, p2 or p3");
    const selected = selectLocalTests(
      requestedTestFiles(args, tests),
      Boolean(requested.length || artifact || value("--priority") || value("--runner") || value("--files-from")),
    ).filter(
      (test) =>
        (!requested.length || requested.some((path) => test === path || test.startsWith(`${path}/`))) &&
        priorities.includes(priorityFromFile(test)!) &&
        (artifact !== "compiled-cli" ||
          (test.startsWith("packages/e2e/src/packaged/") && /\.test\.tsx?$/.test(test))) &&
        (artifact !== "packaged-desktop" || (testRunner(test) === "desktop" && test.includes("/packaged-"))),
    );
    const runs = priorities.flatMap((priority) =>
      createTestRuns(selected, packages, priority as "P0", { scope: value("--scope"), runner: value("--runner") }),
    );
    const quarantine = lane === "quarantine";
    const files = runs
      .flatMap((run) => run.files)
      .filter(
        (file) =>
          !quarantine ||
          quarantineRegistry.some(
            (entry) =>
              entry.file === file &&
              entry.runner === quarantineRunnerForTest(testRunner(file)) &&
              matchesPlatform(entry, process.platform, process.arch),
          ),
      );
    plan = createTestPlan({
      source,
      target: { platform: process.platform, arch: process.arch },
      packages,
      files,
      shard: value("--shard"),
      timingSnapshot,
      coverage,
      artifact: artifact as "compiled-cli" | "packaged-desktop" | "source" | undefined,
      lane: lane === "all" ? undefined : (lane as "stable" | "quarantine" | undefined),
    });
    if (!plan.runs.length && !quarantine) throw new Error("No tests selected");
  }
}
if (value("--out")) await Bun.write(resolve(value("--out")!), JSON.stringify(plan, null, 2));
if (args.includes("--list")) console.log(JSON.stringify(plan, null, 2));
else {
  const job = value("--job");
  const runIds = job ? plan.runs.filter((run) => run.job === job).map((run) => run.id) : undefined;
  if (job && !runIds?.length && !plan.emptyJobs?.includes(job)) throw new Error(`No tests assigned to ${job}`);
  const result = await executePlan(plan, { root, runIds, prebuilt: args.includes("--prebuilt") });
  process.exitCode = result.outcome === "success" ? 0 : 1;
}
