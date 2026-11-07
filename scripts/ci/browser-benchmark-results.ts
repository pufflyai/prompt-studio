import { relative, resolve } from "node:path";
import { verifyBunQuarantineCases } from "./quarantine-reports";

interface BenchmarkTest {
  expectedStatus?: string;
  annotations?: { type: string; description?: string }[];
  results: { status: string; errors?: { message?: string }[] }[];
}
interface BenchmarkSuite {
  suites?: BenchmarkSuite[];
  specs?: { title: string; file: string; tests: BenchmarkTest[] }[];
}
export interface BrowserBenchmarkReport {
  config: { rootDir: string; metadata?: { quarantineAttempt?: string } };
  suites: BenchmarkSuite[];
  errors?: unknown[];
}

const benchmarkRecord = (spec: NonNullable<BenchmarkSuite["specs"]>[number], rootDir: string, root: string) => {
  const file = relative(root, resolve(rootDir, spec.file)).replaceAll("\\", "/");
  if (spec.tests.length !== 1) throw new Error("Browser benchmark must have one project and attempt");
  const test = spec.tests[0]!;
  if (test.results.length !== 1) throw new Error("Browser benchmark must execute once");
  const { status, errors } = test.results[0]!;
  const outcomes: Record<string, string> = {
    passed: "success",
    failed: "failure",
    timedOut: "failure",
    skipped: "skipped",
  };
  const outcome = outcomes[status];
  if (!outcome) throw new Error("Incomplete browser benchmark execution");
  if (status === "skipped" && test.expectedStatus !== "skipped")
    throw new Error("Browser benchmark was unexpectedly skipped");
  return {
    file,
    title: spec.title,
    outcome,
    performanceFailure:
      status === "failed" &&
      Boolean(errors?.length) &&
      (errors ?? []).every((error) => {
        const message = error.message?.replace(/^Error: /, "");
        return (
          typeof message === "string" &&
          test.annotations?.some((entry) => {
            const description = entry.description?.replace(/^Error: /, "");
            return (
              entry.type === "performance-budget-failure" &&
              Boolean(description) &&
              (description === message || message.startsWith(`${description}\n\n`))
            );
          })
        );
      }),
  };
};

/** Classify one ordered execution; quarantine changes the gate, never the workload or ordering. */
export const browserBenchmarkResults = (
  report: BrowserBenchmarkReport,
  expected: { file: string; name: string; failureKind?: "performance" }[],
  root: string,
) => {
  if (report.errors?.length) throw new Error("Browser benchmark setup failed");
  const records: { file: string; title: string; outcome: string; performanceFailure: boolean }[] = [];
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
    throw new Error("Empty or repeated browser benchmark execution");
  const quarantined = (entry: (typeof records)[number]) =>
    expected.some((test) => test.file === entry.file && test.name === entry.title);
  const summary = verifyBunQuarantineCases(records.filter(quarantined), expected);
  return {
    quarantineReport,
    quarantined: summary,
    stableFailures: records.filter((entry) => {
      if (entry.outcome !== "failure") return false;
      const quarantine = expected.find((test) => test.file === entry.file && test.name === entry.title);
      return !quarantine || (quarantine.failureKind === "performance" && !entry.performanceFailure);
    }),
    executed: records.filter((entry) => entry.outcome !== "skipped").length,
  };
};
