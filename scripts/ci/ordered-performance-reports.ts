import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { type BrowserBenchmarkReport, browserBenchmarkResults } from "./browser-benchmark-results";
import type { PlannedRun, TestPlan } from "./test-plan";
import { matchesPlatform, quarantineDirectory, quarantineRegistry } from "./test-quarantine";

const profiles: Record<string, { report: string; runner: string; owner: string }> = {
  frontend: {
    report: "packages/e2e/test-results/workbench-benchmarks.json",
    runner: "workbench-benchmark",
    owner: "packages/e2e",
  },
  desktop: {
    report: "clients/desktop/test-results/packaged-benchmarks.json",
    runner: "packaged-desktop-benchmark",
    owner: "clients/desktop",
  },
};
interface Suite {
  suites?: Suite[];
  specs?: { file: string }[];
}
export const captureOrderedPerformanceReport = (root: string, directory: string, id: string) => {
  const profile = profiles[id];
  if (!profile || !existsSync(join(root, profile.report))) return;
  const report = JSON.parse(readFileSync(join(root, profile.report), "utf8"));
  const rootDir = report.config.rootDir;
  const normalize = (suites: Suite[]) => {
    for (const suite of suites) {
      for (const spec of suite.specs ?? [])
        if (isAbsolute(spec.file)) spec.file = relative(rootDir, spec.file).replaceAll("\\", "/");
      normalize(suite.suites ?? []);
    }
  };
  normalize(report.suites);
  report.config.rootDir = relative(root, rootDir).replaceAll("\\", "/");
  writeFileSync(join(directory, `${id}-ordered.json`), JSON.stringify(report));
  writeFileSync(
    join(directory, `${id}-attempt.json`),
    readFileSync(join(quarantineDirectory(root, profile.runner, profile.owner), "attempt.json")),
  );
};
export const orderedPerformanceResult = (
  directory: string,
  id: string,
  run: PlannedRun,
  plan: TestPlan,
  executionId: string,
  selected: number,
) => {
  const profile = profiles[id];
  if (!profile) return;
  const reports = [`${id}-ordered.json`, `${id}-attempt.json`];
  const report = JSON.parse(readFileSync(join(directory, reports[0]!), "utf8")) as BrowserBenchmarkReport;
  const attempt = JSON.parse(readFileSync(join(directory, reports[1]!), "utf8"));
  if (
    attempt.planDigest !== plan.digest ||
    attempt.runId !== run.id ||
    attempt.executionId !== executionId ||
    attempt.sourceSha !== plan.source.sha ||
    attempt.platform !== run.target.platform ||
    attempt.arch !== run.target.arch ||
    !attempt.token ||
    report.config.metadata?.quarantineAttempt !== attempt.token
  )
    throw new Error("Stale ordered benchmark attempt");
  if (isAbsolute(report.config.rootDir) || report.config.rootDir.split("/").includes(".."))
    throw new Error("Invalid portable benchmark root");
  const root = "/planned-source";
  report.config.rootDir = resolve(root, report.config.rootDir);
  const expected = quarantineRegistry.filter(
    (entry) =>
      entry.runner === profile.runner &&
      matchesPlatform(entry, run.target.platform, run.target.arch) &&
      run.files.includes(entry.file),
  );
  const result = browserBenchmarkResults(report, expected, root);
  if (result.selected !== selected) throw new Error("Ordered benchmark selection differs from terminal cases");
  return { nativeFailure: result.stableFailures.length > 0, reports };
};
