import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { coverageReport, type ExecutionEvidence } from "./coverage-report";
import { isProductionSource, mergeCoverageHits } from "./coverage-source";

export interface CoverageReport {
  packageDir: string;
  content: string;
}

export interface CoverageSummary {
  coveredLines: number;
  totalLines: number;
}

const badgeColors: Array<[minimum: number, color: string]> = [
  [90, "brightgreen"],
  [80, "green"],
  [70, "yellowgreen"],
  [60, "yellow"],
  [50, "orange"],
  [0, "red"],
];

// Each package report also lists the source of every package its tests import, so merge
// line hits per file before counting. Bun writes source paths relative to the package.
export const summarizeCoverage = (root: string, reports: CoverageReport[]) => {
  const files = mergeCoverageHits(root, reports);
  const hits = [...files].filter(([path]) => isProductionSource(path)).flatMap(([, lines]) => [...lines.values()]);
  return { coveredLines: hits.filter((count) => count > 0).length, totalLines: hits.length };
};

export const coverageBadge = (summary: CoverageSummary) => {
  if (summary.totalLines === 0) throw new Error("No source lines were measured.");
  const percent = Math.round((100 * summary.coveredLines) / summary.totalLines);
  const [, color] = badgeColors.find(([minimum]) => percent >= minimum) ?? [];
  return { schemaVersion: 1, label: "coverage", message: `${percent}%`, color };
};

interface CoverageArtifactsInput {
  root: string;
  output: string;
  reports: CoverageReport[];
  scope: string;
  execution?: ExecutionEvidence[];
  workflowRunId?: number;
}
export const writeCoverageArtifacts = (input: CoverageArtifactsInput) => {
  const { root, output, reports, scope, execution } = input;
  const summary = summarizeCoverage(root, reports);
  const badge = coverageBadge(summary);
  const tracked = spawnSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" });
  const revision = spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" });
  if (tracked.status !== 0 || revision.status !== 0) throw new Error("Cannot identify coverage source revision.");
  const report = coverageReport({
    root,
    revision: revision.stdout.trim(),
    scope,
    measuredAt: new Date().toISOString(),
    trackedFiles: tracked.stdout.split("\0").filter(Boolean),
    reports,
    execution,
    workflowRunId: input.workflowRunId,
  });
  mkdirSync(dirname(resolve(output)), { recursive: true });
  writeFileSync(output, `${JSON.stringify(badge, null, 2)}\n`);
  writeFileSync(join(dirname(resolve(output)), "coverage-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    `Line coverage: ${badge.message} (${summary.coveredLines}/${summary.totalLines}) from ${reports.length} reports.`,
  );
};

if (import.meta.main) {
  const output = process.argv[2];
  if (!output) throw new Error("Usage: summarize-coverage.ts <badge-json-path>");
  const root = process.cwd();
  const reports = ["packages", "extensions", "services", "clients", ".pstdio/extensions"].flatMap((group) =>
    Array.from(new Bun.Glob(`${group}/*/coverage/**/lcov.info`).scanSync({ cwd: root })).map((file) => ({
      packageDir: join(root, file.split("/coverage/")[0]),
      content: readFileSync(join(root, file), "utf8"),
    })),
  );
  if (!reports.length) throw new Error("No lcov reports found. Run `bun run test:coverage` first.");
  const executionPath = process.env.COVERAGE_EXECUTION_REPORT;
  writeCoverageArtifacts({
    root,
    output,
    reports,
    scope: process.env.COVERAGE_SCOPE ?? "unit-source",
    execution: executionPath ? (JSON.parse(readFileSync(executionPath, "utf8")) as ExecutionEvidence[]) : undefined,
  });
}
