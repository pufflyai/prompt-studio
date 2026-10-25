import { mkdirSync } from "node:fs";
import { cpus, platform, release, totalmem } from "node:os";
import { runCiChecks } from "./run-ci-checks";
import { discoverTestFiles } from "./test-discovery";

const performanceChecks = (family: string) => {
  if (family === "backend")
    return discoverTestFiles(process.cwd())
      .filter(
        (path) => path.startsWith("packages/") && !path.startsWith("packages/e2e/") && path.endsWith(".p3.bench.ts"),
      )
      .map((path) => ({ id: path, command: ["bun", path] }));
  if (family === "browser")
    return [
      { id: "chat-rendering", command: ["bun", "run", "--cwd", "packages/ui", "perf:chat"] },
      {
        id: "frontend",
        command: [
          "bun",
          "run",
          "--cwd",
          "packages/e2e",
          "src/scripts/run-playwright.ts",
          "-c",
          "playwright.perf.config.ts",
        ],
      },
      { id: "packaged-collections", command: ["bun", "run", "--cwd", "packages/e2e", "test:packaged:benchmark"] },
    ];
  if (family === "navigation")
    return [{ id: "sidenav-subnav", command: ["bun", "run", "--cwd", "packages/e2e", "perf:subnav"] }];
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
    measurementPolicy: "Use each benchmark's fixed default workload and existing operation budgets unchanged",
  };
  await Bun.write(`${directory}/metadata.json`, JSON.stringify(metadata, null, 2));
  const report = await runCiChecks(checks, { priority: "P3", concurrency: 1, env: { UI_PERF_ASSERT_BUDGETS: "1" } });
  await Bun.write(`${directory}/results.json`, JSON.stringify(report, null, 2));
  if (report.outcome !== "success") process.exitCode = 1;
}
