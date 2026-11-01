import { mkdirSync } from "node:fs";
import { cpus, platform, release, totalmem } from "node:os";
import { runCiChecks } from "./run-ci-checks";

const performanceChecks = (family: string) => {
  // Backend suites run as separate jobs: together they exceed the release's critical path on Windows.
  if (family === "storage" || family === "runtime")
    return [
      {
        id: family,
        command: [
          "bun",
          "packages/benchmarks/src/cli.ts",
          "sample",
          "--suite",
          family,
          "--out",
          `test-results/production-performance/${family}/${family}.jsonl`,
        ],
      },
    ];
  if (family === "browser")
    return [
      { id: "chat-rendering", command: ["bun", "run", "--cwd", "packages/ui", "perf:chat"] },
      { id: "canvas-startup", command: ["bun", "run", "--cwd", "packages/canvas-tests", "perf:startup"] },
      {
        id: "frontend",
        command: ["bun", "scripts/ci/run-workbench-benchmarks.ts"],
      },
      { id: "packaged-collections", command: ["bun", "run", "--cwd", "packages/e2e", "test:packaged:benchmark"] },
    ];
  if (family === "navigation")
    return [{ id: "sidenav-subnav", command: ["bun", "scripts/ci/run-subnav-benchmarks.ts"] }];
  if (family === "planner")
    return [
      {
        id: "planner-stress",
        command: ["bun", "run", "--cwd", "packages/e2e", "test:planner-stress", "--", "--packaged"],
      },
      { id: "planner-cold-open", command: ["bun", "run", "--cwd", "packages/e2e", "perf:planner-board-cold-open"] },
    ];
  if (family === "relay")
    return [{ id: "relay-storage-bound", command: ["bun", "run", "--cwd", "services/relay", "bench:storage-bound"] }];
  throw new Error(`Unknown performance family: ${family}`);
};

if (import.meta.main) {
  const family = process.argv[2]!;
  const checks = performanceChecks(family);
  const directory = `test-results/production-performance/${family}`;
  mkdirSync(directory, { recursive: true });
  if (family === "storage" || family === "runtime")
    for (const check of checks) await Bun.write(`${directory}/${check.id}.jsonl`, "");
  const metadata = {
    sourceSha: process.env.SOURCE_SHA,
    versionSha: process.env.VERSION_SHA,
    runId: process.env.GITHUB_RUN_ID,
    attempt: process.env.GITHUB_RUN_ATTEMPT,
    runnerImage: process.env.ImageOS,
    runnerImageVersion: process.env.ImageVersion,
    platform: platform(),
    release: release(),
    arch: process.arch,
    cpu: cpus()[0]?.model,
    memory: totalmem(),
    bun: Bun.version,
    trace: "off",
    checks,
    // Sampling, cold/warm boundaries and budgets belong to each maintained benchmark.
    measurementPolicy: "Use registered benchmark workloads and existing operation budgets unchanged",
  };
  await Bun.write(`${directory}/metadata.json`, JSON.stringify(metadata, null, 2));
  const report = await runCiChecks(checks, { priority: "P3", concurrency: 1 });
  await Bun.write(`${directory}/results.json`, JSON.stringify(report, null, 2));
  if (report.outcome !== "success") process.exitCode = 1;
}
