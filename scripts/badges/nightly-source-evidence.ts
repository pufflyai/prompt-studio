import { readFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import type { CoverageReport } from "./coverage-badge";

interface Evidence {
  sourceSha?: string;
  priority?: string;
  lane?: string;
  packageDir?: string;
  reportedFiles?: string[];
  complete?: boolean;
  exitCode?: number;
  outcome?: string;
  selectedFiles?: string[];
  files?: unknown[];
  coverage?: { file: string | null; sourceRoot: string } | null;
}
interface ApiFileResult {
  file: string;
  outcome: string;
  report: string;
  cases?: Evidence;
}

const sourceSelections = (documents: Map<string, Evidence>) => {
  const selections: Evidence[] = [];
  for (const [path, evidence] of documents) {
    if (evidence.selectedFiles) {
      selections.push(evidence);
      continue;
    }
    if (basename(path) !== "results.json" || !evidence.sourceSha || !Array.isArray(evidence.files)) continue;
    const selected = documents.get(resolve(dirname(path), "selected.json"))?.files as string[] | undefined;
    const files = evidence.files as ApiFileResult[];
    if (
      !selected ||
      selected.length !== files.length ||
      selected.some((file) => files.filter((result) => result.file === file).length !== 1) ||
      files.some((file) => file.outcome !== "success" || file.report !== "present" || !file.cases?.complete)
    )
      throw new Error(`Invalid nightly source selection: ${path}`);
    selections.push({ ...evidence, selectedFiles: selected.map((file) => `packages/pstdio-api/${file}`) });
  }
  return selections;
};

const requireSourceEvidence = (evidence: Evidence, revision: string, path: string) => {
  if (
    evidence.sourceSha !== revision ||
    evidence.lane !== "stable" ||
    !["P0", "P1", "P2"].includes(evidence.priority ?? "") ||
    !evidence.complete ||
    evidence.exitCode !== 0 ||
    !evidence.reportedFiles?.length
  )
    throw new Error(`Invalid nightly source evidence: ${path}`);
};

const requireSelectedFiles = (
  selections: Evidence[],
  reportedFiles: Set<string>,
  revision: string,
  producer: string,
) => {
  for (const selection of selections) {
    if (selection.sourceSha !== revision || selection.outcome !== "success" || selection.complete === false)
      throw new Error(`Invalid nightly source selection: ${producer}`);
    for (const file of selection.selectedFiles!)
      if (!reportedFiles.has(file)) throw new Error(`Missing nightly source execution: ${file}`);
  }
};

const requireApiSelection = (documents: Map<string, Evidence>, path: string, revision: string) => {
  const directory = dirname(dirname(dirname(path)));
  const summary = documents.get(resolve(directory, "results.json"));
  const selected = documents.get(resolve(directory, "selected.json"));
  if (
    !summary ||
    !Array.isArray(summary.files) ||
    !Array.isArray(selected?.files) ||
    summary.sourceSha !== revision ||
    !summary.complete ||
    summary.outcome !== "success"
  )
    throw new Error(`Missing or incomplete nightly API selection: ${directory}`);
};

export const readNightlySourceProducer = (root: string, producer: string, revision: string) => {
  const documents = new Map(
    Array.from(new Bun.Glob("**/*.json").scanSync({ cwd: producer, absolute: true })).map((path) => [
      path,
      JSON.parse(readFileSync(path, "utf8")) as Evidence,
    ]),
  );
  const selections = sourceSelections(documents);
  const records = [...documents].filter(
    ([path, evidence]) =>
      basename(path) === "cases.json" && evidence.lane !== "quarantine" && evidence.priority !== "P3",
  );
  const singleDatabase = records.length === 1 && records[0]![1].packageDir === "packages/pstdio-db";
  if (!selections.length && !singleDatabase) throw new Error(`Missing nightly source selection: ${producer}`);
  const reports: CoverageReport[] = [];
  const reportedFiles = new Set<string>();
  for (const [path, evidence] of records) {
    requireSourceEvidence(evidence, revision, path);
    if (evidence.packageDir === "packages/pstdio-api") requireApiSelection(documents, path, revision);
    for (const file of evidence.reportedFiles ?? []) reportedFiles.add(file);
    if (evidence.outcome === "unselected") continue;
    if (!evidence.coverage || evidence.coverage.sourceRoot !== "repository")
      throw new Error(`Invalid nightly source evidence: ${path} has no source measurement`);
    if (evidence.coverage.file)
      reports.push({ packageDir: root, content: readFileSync(resolve(dirname(path), evidence.coverage.file), "utf8") });
  }
  requireSelectedFiles(selections, reportedFiles, revision, producer);
  return reports;
};
