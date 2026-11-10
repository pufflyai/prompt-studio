import { suites } from "./benchmark-registry";
export const performanceChecks = (family: string) => {
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
  if (family === "desktop") return [{ id: "desktop", command: ["bun", "scripts/ci/run-desktop-benchmarks.ts"] }];
  if (family === "relay")
    return [{ id: "relay-storage-bound", command: ["bun", "run", "--cwd", "services/relay", "bench:storage-bound"] }];
  throw new Error(`Unknown performance family: ${family}`);
};

export const productionPerformanceFiles = (family: string) => {
  performanceChecks(family);
  const ids: Record<string, string[]> = {
    browser: ["chat", "canvas", "workbench"],
    navigation: ["subnav"],
    planner: ["planner"],
    storage: ["storage"],
    runtime: ["runtime"],
    relay: ["relay"],
    desktop: ["desktop"],
  };
  const files = suites.filter((suite) => ids[family]!.includes(suite.id)).flatMap((suite) => suite.files);
  if (family === "planner") files.push("packages/e2e/src/perf/planner-stress.diagnostic.ts");
  return files.sort();
};
