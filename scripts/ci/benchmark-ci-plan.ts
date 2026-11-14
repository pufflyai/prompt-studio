import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { suites } from "./benchmark-registry";
import { performanceSuites } from "./production-performance-profile";
import { productionDesktopPlatforms, productionPerformanceWorkloads } from "./production-platforms";
import type { TestPackage } from "./runner-profiles";
import { createTestPlan, mergeTestPlans, type SourceIdentity } from "./test-plan";
import { testPlanSource } from "./test-plan-source";
import { readWorkspacePackages } from "./workspace-packages";

export const createBenchmarkCiPlan = (source: SourceIdentity, packages: TestPackage[], channel: string) => {
  if (!["stable", "nightly"].includes(channel)) throw new Error(`Unknown release channel: ${channel}`);
  const hosts = productionDesktopPlatforms(channel);
  const assignments = [
    ...hosts.flatMap((host) =>
      performanceSuites("desktop", host.target).map((suite) => ({ ...host, suite: suite.id })),
    ),
    ...productionPerformanceWorkloads(channel).flatMap(({ family, os }) => {
      const host = productionDesktopPlatforms("stable").find((host) => host.os === os)!;
      return performanceSuites(family, host.target).map((suite) => ({ ...host, suite: suite.id }));
    }),
  ].map((row) => ({ ...row, job: `benchmark-${row.target}-${row.suite}` }));
  const plan = mergeTestPlans(
    assignments.map((row) => {
      const suite = suites.find((suite) => suite.id === row.suite);
      if (!suite) throw new Error(`Missing registered benchmark suite: ${row.suite}`);
      return createTestPlan({
        source,
        packages,
        target: { platform: row.platform, arch: row.arch },
        files: suite.files,
        job: row.job,
        reason: `${channel} source benchmark qualification: ${row.suite}`,
      });
    }),
    source,
  );
  return { plan, matrix: assignments };
};

if (import.meta.main) {
  const root = resolve(import.meta.dirname, "../..");
  const packages = readWorkspacePackages(root).map((pkg) => ({ ...pkg, scripts: {} }));
  const { plan, matrix } = createBenchmarkCiPlan(testPlanSource(root), packages, process.argv[2] ?? "stable");
  const directory = resolve(root, "test-results/ci");
  mkdirSync(directory, { recursive: true });
  writeFileSync(resolve(directory, "plan.json"), JSON.stringify(plan, null, 2));
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `matrix=${JSON.stringify(matrix)}\n`);
  console.log(JSON.stringify({ source: plan.source, digest: plan.digest, matrix }, null, 2));
}
