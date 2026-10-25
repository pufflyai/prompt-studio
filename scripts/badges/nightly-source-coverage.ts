import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { type CoverageReport, writeCoverageArtifacts } from "./coverage-badge";
import { readNightlySourceProducer } from "./nightly-source-evidence";

export const collectNightlySourceCoverage = (
  root: string,
  artifacts: string,
  revision: string,
  expectedArtifacts: string[],
) => {
  if (!expectedArtifacts.length) throw new Error("No nightly source coverage producers selected");
  const reports: CoverageReport[] = [];
  for (const name of expectedArtifacts) {
    const producer = resolve(artifacts, name);
    if (!existsSync(producer)) throw new Error(`Missing nightly source producer: ${name}`);
    reports.push(...readNightlySourceProducer(root, producer, revision));
  }
  if (!reports.length) throw new Error("No nightly source coverage was collected");
  return reports;
};

if (import.meta.main) {
  const root = process.cwd();
  const revision = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  if (revision !== process.env.CI_COVERAGE_SOURCE_SHA) throw new Error("Nightly coverage checkout mismatch");
  writeCoverageArtifacts({
    root,
    output: process.argv[3]!,
    reports: collectNightlySourceCoverage(
      root,
      process.argv[2]!,
      revision,
      JSON.parse(process.env.CI_COVERAGE_ARTIFACTS ?? "[]"),
    ),
    scope: "full-nightly/P0-P2/source",
  });
}
