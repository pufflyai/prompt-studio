import type { TestPriority } from "../ci/test-policy";
import type { CoverageReport } from "./coverage-badge";
import { isProductionSource, mergeCoverageHits } from "./coverage-source";

export interface ExecutionEvidence {
  revision: string;
  stage: string;
  platform: string;
  priority: TestPriority;
  quarantined: boolean;
  selectedCaseIds: string[];
  cases: Array<{ id: string; outcome: "success" | "failure" | "cancelled" | "skipped" }>;
}

interface ReportInput {
  root: string;
  revision: string;
  scope: string;
  measuredAt: string;
  trackedFiles: string[];
  reports: CoverageReport[];
  execution?: ExecutionEvidence[];
}

const executionReport = (evidence: ExecutionEvidence, revision: string) => {
  const selected = new Set(evidence.selectedCaseIds);
  const observed = new Set(evidence.cases.map((entry) => entry.id));
  const missingCaseIds = [...selected].filter((id) => !observed.has(id));
  const unexpectedCaseIds = [...observed].filter((id) => !selected.has(id));
  const duplicateCaseIds = evidence.cases
    .filter((entry, index, cases) => cases.findIndex((other) => other.id === entry.id) !== index)
    .map((entry) => entry.id);
  const revisionMatches = evidence.revision === revision;
  const incomplete = !revisionMatches || missingCaseIds.length || unexpectedCaseIds.length || duplicateCaseIds.length;
  let outcome = "success";
  if (incomplete) outcome = "incomplete";
  else if (evidence.cases.some((entry) => entry.outcome !== "success")) outcome = "failure";
  return {
    ...evidence,
    selected: selected.size,
    completed: evidence.cases.filter((entry) => entry.outcome === "success" || entry.outcome === "failure").length,
    missingCaseIds,
    unexpectedCaseIds,
    duplicateCaseIds,
    revisionMatches,
    outcome,
  };
};

export const coverageReport = (input: ReportInput) => {
  const files = mergeCoverageHits(input.root, input.reports);
  const importedFiles = [...files.keys()].filter(isProductionSource).sort();
  const hits = importedFiles.flatMap((path) => [...files.get(path)!.values()]);
  return {
    revision: input.revision,
    scope: input.scope,
    measuredAt: input.measuredAt,
    source: {
      denominator: "Executable lines in imported production source files only",
      coveredLines: hits.filter((count) => count > 0).length,
      totalLines: hits.length,
      importedFiles,
      unimportedFiles: input.trackedFiles.filter((path) => isProductionSource(path) && !files.has(path)).sort(),
    },
    execution: input.execution
      ? { state: "provided", reports: input.execution.map((evidence) => executionReport(evidence, input.revision)) }
      : { state: "not-provided", reports: [] },
    limits:
      "Browser, compiled and platform contracts are execution evidence; they do not contribute to source line percentages.",
  };
};
