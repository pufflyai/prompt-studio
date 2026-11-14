import { suites } from "./benchmark-registry";
export const performanceSuites = (family: string, platform = `${process.platform}-${process.arch}`) => {
  const ids: Record<string, string[]> = {
    desktop: ["B1", "B2", "B3", "B4", "B5", "B8"],
    planner: ["B6"],
    storage: ["B7"],
  };
  if (!ids[family]) throw new Error(`Unknown performance family: ${family}`);
  return suites.filter((suite) => ids[family]!.includes(suite.id) && suite.platforms?.includes(platform));
};
export const performanceChecks = (family: string, platform = `${process.platform}-${process.arch}`) =>
  performanceSuites(family, platform).map((suite) => ({
    id: suite.id,
    command: [
      "bun",
      "packages/benchmarks/src/cli.ts",
      "sample",
      "--suite",
      suite.id,
      "--sha",
      process.env.CI_PLAN_SOURCE_SHA ?? "",
      "--out",
      `test-results/production-performance/${family}/${suite.id}-metrics.jsonl`,
    ],
  }));
export const productionPerformanceFiles = (family: string, platform?: string) =>
  performanceSuites(family, platform)
    .flatMap((suite) => suite.files)
    .sort();
