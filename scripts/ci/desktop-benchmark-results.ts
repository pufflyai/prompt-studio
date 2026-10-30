import { relative, resolve } from "node:path";
import { verifyBunQuarantineCases } from "./quarantine-reports";

interface BenchmarkTest {
  expectedStatus?: string;
  results: { status: string }[];
}
interface BenchmarkSuite {
  suites?: BenchmarkSuite[];
  specs?: { title: string; file: string; tests: BenchmarkTest[] }[];
}
export interface DesktopBenchmarkReport {
  config: { rootDir: string; metadata?: { quarantineAttempt?: string } };
  suites: BenchmarkSuite[];
  errors?: unknown[];
}

const benchmarkRecord = (spec: NonNullable<BenchmarkSuite["specs"]>[number], rootDir: string, root: string) => {
  const file = relative(root, resolve(rootDir, spec.file)).replaceAll("\\", "/");
  if (spec.tests.length !== 1) throw new Error("Desktop benchmark must have one project and attempt");
  const test = spec.tests[0]!;
  if (test.results.length !== 1) throw new Error("Desktop benchmark must execute once");
  const status = test.results[0]!.status;
  const outcomes: Record<string, string> = {
    passed: "success",
    failed: "failure",
    timedOut: "failure",
    skipped: "skipped",
  };
  const outcome = outcomes[status];
  if (!outcome) throw new Error("Incomplete desktop benchmark execution");
  if (status === "skipped" && test.expectedStatus !== "skipped")
    throw new Error("Desktop benchmark was unexpectedly skipped");
  return { file, title: spec.title, outcome };
};

/** Classify one ordered execution; quarantine changes the gate, never the workload or ordering. */
export const desktopBenchmarkResults = (
  report: DesktopBenchmarkReport,
  expected: { file: string; name: string }[],
  root: string,
) => {
  if (report.errors?.length) throw new Error("Desktop benchmark setup failed");
  const records: { file: string; title: string; outcome: string }[] = [];
  const filtered = (suites: BenchmarkSuite[]): BenchmarkSuite[] =>
    suites.map((suite) => ({
      ...suite,
      suites: filtered(suite.suites ?? []),
      specs: (suite.specs ?? []).filter((spec) => {
        const record = benchmarkRecord(spec, report.config.rootDir, root);
        records.push(record);
        return expected.some((entry) => entry.file === record.file && entry.name === record.title);
      }),
    }));
  const quarantineReport = { config: report.config, suites: filtered(report.suites), errors: [] };
  if (!records.length || new Set(records.map((entry) => `${entry.file}:${entry.title}`)).size !== records.length)
    throw new Error("Empty or repeated desktop benchmark execution");
  const quarantined = (entry: (typeof records)[number]) =>
    expected.some((test) => test.file === entry.file && test.name === entry.title);
  const summary = verifyBunQuarantineCases(records.filter(quarantined), expected);
  return {
    quarantineReport,
    quarantined: summary,
    stableFailures: records.filter((entry) => !quarantined(entry) && entry.outcome === "failure"),
    executed: records.filter((entry) => entry.outcome !== "skipped").length,
  };
};
