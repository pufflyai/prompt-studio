import { relative } from "node:path";

interface QuarantinedTest {
  runner: string;
  file: string;
  name: string;
  platforms: string[];
}

const escapeRegex = (name: string) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const quarantinePattern = (cases: QuarantinedTest[], runner: string, platform: string) => {
  const names = cases.filter((entry) => entry.runner === runner && entry.platforms.includes(platform));
  return names.length ? `(?:${names.map((entry) => escapeRegex(entry.name)).join("|")})$` : undefined;
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
    count: selected.filter((entry) => entry.platforms.includes(platform)).length,
    pattern: quarantine ? pattern : pattern && `^(?!.*${pattern}).*$`,
    files: [
      ...new Set(
        selected.filter((entry) => entry.platforms.includes(platform)).map((entry) => relative(packageDir, entry.file)),
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
};
