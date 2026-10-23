import { relative } from "node:path";

interface QuarantinedTest {
  runner: string;
  file: string;
  name: string;
  platforms: string[];
  arch?: string;
}

const escapeRegex = (name: string) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const matchesPlatform = (entry: QuarantinedTest, platform: string, arch: string) =>
  entry.platforms.includes(platform) && (!entry.arch || entry.arch === arch);

export const quarantinePattern = (cases: QuarantinedTest[], runner: string, platform: string, arch = process.arch) => {
  const names = cases.filter((entry) => entry.runner === runner && matchesPlatform(entry, platform, arch));
  const tags = runner === "bun" ? "" : "(?:\\s+@\\S+)*";
  return names.length ? `(?:${names.map((entry) => escapeRegex(entry.name)).join("|")})${tags}$` : undefined;
};

export const bunTestSelection = (
  cases: QuarantinedTest[],
  packageDir: string,
  platform: string,
  quarantine: boolean,
) => {
  const selected = cases.filter((entry) => entry.runner === "bun" && entry.file.startsWith(`${packageDir}/`));
  const pattern = quarantinePattern(selected, "bun", platform);
  return {
    count: selected.filter((entry) => matchesPlatform(entry, platform, process.arch)).length,
    pattern: quarantine ? pattern : pattern && `^(?!.*${pattern}).*$`,
    files: [
      ...new Set(
        selected
          .filter((entry) => matchesPlatform(entry, platform, process.arch))
          .map((entry) => relative(packageDir, entry.file)),
      ),
    ],
  };
};

export const verifyQuarantineReport = (xml: string, expected: number) => {
  const summary = xml.match(/<testsuites\b[^>]*>/)?.[0] ?? "";
  const tests = Number(summary.match(/\btests="(\d+)"/)?.[1]);
  const skipped = Number(summary.match(/\bskipped="(\d+)"/)?.[1]);
  if (tests - skipped !== expected) {
    throw new Error(
      `Quarantine expected ${expected} executed cases, got ${tests - skipped}. Check the register and report.`,
    );
  }
  return { executed: tests - skipped, failures: Number(summary.match(/\bfailures="(\d+)"/)?.[1] ?? 0) };
};

interface BrowserSuite {
  suites?: BrowserSuite[];
  specs?: { title: string; tests: { results: { status: string }[] }[] }[];
}

export const verifyPlaywrightQuarantineReport = (
  report: { suites: BrowserSuite[]; errors?: unknown[] },
  names: string[],
) => {
  const specs = (suites: BrowserSuite[]): NonNullable<BrowserSuite["specs"]> =>
    suites.flatMap((suite) => [...(suite.specs ?? []), ...specs(suite.suites ?? [])]);
  const cases = specs(report.suites);
  if (report.errors?.length || cases.length !== names.length) throw new Error("Incomplete browser quarantine report.");
  let failures = 0;
  for (const entry of cases) {
    const results = entry.tests.flatMap((test) => test.results);
    if (
      !names.includes(entry.title) ||
      results.length !== 1 ||
      !["passed", "failed", "timedOut"].includes(results[0].status)
    ) {
      throw new Error(`Quarantine case must execute exactly once: ${entry.title}`);
    }
    if (results[0].status !== "passed") failures += 1;
  }
  return { executed: cases.length, failures };
};
