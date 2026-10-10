import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

export interface CoverageReport {
  packageDir: string;
  content: string;
}

export interface CoverageSummary {
  coveredLines: number;
  totalLines: number;
}

const excludedSource =
  /(^|\/)(node_modules|dist|mocks?|__tests__|__test-tmp__)\/|\.(test|spec|stories)\.|fixture|test-utils|test-support|test-setup|mock-data/;

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
  const files = new Map<string, Map<number, number>>();
  for (const report of reports) {
    let lines: Map<number, number> | undefined;
    for (const entry of report.content.split("\n")) {
      if (entry.startsWith("SF:")) {
        const path = resolve(report.packageDir, entry.slice(3));
        const repoPath = relative(root, path);
        lines = undefined;
        if (!repoPath.startsWith("..") && !excludedSource.test(repoPath)) {
          lines = files.get(path) ?? new Map();
          files.set(path, lines);
        }
      } else if (lines && entry.startsWith("DA:")) {
        const [line, hits] = entry.slice(3).split(",").map(Number);
        lines.set(line, (lines.get(line) ?? 0) + hits);
      }
    }
  }

  const hits = [...files.values()].flatMap((lines) => [...lines.values()]);
  return { coveredLines: hits.filter((count) => count > 0).length, totalLines: hits.length };
};

export const coverageBadge = (summary: CoverageSummary) => {
  if (summary.totalLines === 0) throw new Error("No source lines were measured.");
  const percent = Math.round((100 * summary.coveredLines) / summary.totalLines);
  const [, color] = badgeColors.find(([minimum]) => percent >= minimum) ?? [];
  return { schemaVersion: 1, label: "coverage", message: `${percent}%`, color };
};

if (import.meta.main) {
  const output = process.argv[2];
  if (!output) throw new Error("Usage: summarize-coverage.ts <badge-json-path>");

  const root = process.cwd();
  const reports = ["packages", "extensions"].flatMap((group) =>
    Array.from(new Bun.Glob(`${group}/*/coverage/**/lcov.info`).scanSync({ cwd: root })).map((file) => ({
      packageDir: join(root, file.split("/coverage/")[0]),
      content: readFileSync(join(root, file), "utf8"),
    })),
  );
  if (reports.length === 0) throw new Error("No lcov reports found. Run `bun run test:coverage` first.");

  const summary = summarizeCoverage(root, reports);
  const badge = coverageBadge(summary);
  mkdirSync(dirname(resolve(output)), { recursive: true });
  writeFileSync(output, `${JSON.stringify(badge, null, 2)}\n`);
  console.log(
    `Line coverage: ${badge.message} (${summary.coveredLines}/${summary.totalLines}) from ${reports.length} reports.`,
  );
}
