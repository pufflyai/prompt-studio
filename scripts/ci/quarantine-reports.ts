import { relative, resolve } from "node:path";
import { junitCases } from "./bun-test-evidence";

interface ExpectedCase {
  file: string;
  name: string;
}
interface ReportedCase {
  file: string;
  title: string;
  outcome: string;
}
const matchesTitle = (title: string, name: string) => title === name || title.endsWith(` > ${name}`);
const matchesCase = (actual: ReportedCase, expected: ExpectedCase) =>
  actual.file.replaceAll("\\", "/") === expected.file && matchesTitle(actual.title, expected.name);

export const verifyBunQuarantineCases = (reported: ReportedCase[], expected: ExpectedCase[]) => {
  let failures = 0;
  for (const entry of expected) {
    const found = reported.filter((actual) => matchesCase(actual, entry));
    if (found.length !== 1 || !["success", "failure"].includes(found[0]!.outcome))
      throw new Error(`Quarantine case must execute exactly once: ${entry.file}: ${entry.name}`);
    if (found[0]!.outcome === "failure") failures++;
  }
  if (reported.some((actual) => actual.outcome !== "skipped" && !expected.some((entry) => matchesCase(actual, entry))))
    throw new Error("Unexpected quarantine execution");
  return { executed: expected.length, failures };
};

export const verifyQuarantineReport = (xml: string, expected: ExpectedCase[], root: string, cwd: string) => {
  if (!xml.includes("</testsuites>")) throw new Error("Incomplete quarantine XML");
  const summary = xml.match(/<testsuites\b[^>]*>/)?.[0] ?? "";
  if (Number(summary.match(/\berrors="(\d+)"/)?.[1] ?? 0) > 0) throw new Error("Quarantine setup or teardown failed");
  const reported = junitCases(xml).map((entry) => ({
    ...entry,
    file: relative(root, resolve(cwd, entry.file)).replaceAll("\\", "/"),
  }));
  return verifyBunQuarantineCases(reported, expected);
};

export const assertStableQuarantineExclusions = (reported: ReportedCase[], expected: ExpectedCase[]) => {
  for (const entry of expected) {
    const matches = reported.filter((actual) => matchesTitle(actual.title, entry.name));
    if (matches.some((actual) => !matchesCase(actual, entry) || actual.outcome !== "skipped") || matches.length > 1)
      throw new Error(`Ambiguous or bypassed quarantine: ${entry.file}: ${entry.name}`);
  }
};

interface BrowserSuite {
  suites?: BrowserSuite[];
  specs?: { title: string; file: string; tests: { results: { status: string }[] }[] }[];
}
export const verifyPlaywrightQuarantineReport = (
  report: { config: { rootDir: string }; suites: BrowserSuite[]; errors?: unknown[] },
  expected: ExpectedCase[],
  root: string,
) => {
  const specs = (suites: BrowserSuite[]): NonNullable<BrowserSuite["specs"]> =>
    suites.flatMap((suite) => [...(suite.specs ?? []), ...specs(suite.suites ?? [])]);
  if (report.errors?.length) throw new Error("Incomplete browser quarantine report");
  const found = specs(report.suites);
  if (found.length !== expected.length) throw new Error("Incomplete browser quarantine report");
  const records = found.map((entry) => {
    const results = entry.tests.flatMap((test) => test.results);
    if (results.length !== 1 || !["passed", "failed", "timedOut"].includes(results[0]!.status))
      throw new Error(`Quarantine case must execute exactly once: ${entry.title}`);
    return {
      file: relative(root, resolve(report.config.rootDir, entry.file)).replaceAll("\\", "/"),
      title: entry.title,
      outcome: results[0]!.status === "passed" ? "success" : "failure",
    };
  });
  return verifyBunQuarantineCases(records, expected);
};

interface QuarantineIdentity {
  sourceSha: string;
  policyDigest: string;
  platform: string;
  arch: string;
}
export const verifyQuarantineAttempt = (
  attempt: QuarantineIdentity & { token: string },
  identity: QuarantineIdentity,
  token: unknown,
) => {
  if (
    !attempt.token ||
    attempt.token !== token ||
    attempt.sourceSha !== identity.sourceSha ||
    attempt.policyDigest !== identity.policyDigest ||
    attempt.platform !== identity.platform ||
    attempt.arch !== identity.arch
  )
    throw new Error("Stale or mismatched quarantine attempt");
};
