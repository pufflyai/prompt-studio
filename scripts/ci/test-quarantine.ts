import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface QuarantinedTest {
  runner: string;
  file: string;
  name: string;
  platforms: string[];
  arch?: string;
  cliVersion?: string;
}

export const quarantineRegistry = JSON.parse(
  readFileSync(new URL("./test-quarantine.json", import.meta.url), "utf8"),
) as QuarantinedTest[];

export const quarantineRunnerForTest = (runner: string) => {
  const runners: Record<string, string> = {
    app: "playwright-ui",
    "packaged-cli": "packaged-bun",
    "packaged-browser": "playwright",
    desktop: "packaged-desktop",
  };
  return runners[runner] ?? "bun";
};

const escapeRegex = (name: string) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const matchesPlatform = (entry: QuarantinedTest, platform: string, arch: string) =>
  entry.platforms.includes(platform) && (!entry.arch || entry.arch === arch);

export const quarantinePattern = (cases: QuarantinedTest[], runner: string, platform: string, arch = process.arch) => {
  const names = cases.filter((entry) => entry.runner === runner && matchesPlatform(entry, platform, arch));
  const tags = runner === "bun" || runner === "packaged-bun" ? "" : "(?:\\s+@\\S+)*";
  return names.length ? `(?:${names.map((entry) => escapeRegex(entry.name)).join("|")})${tags}$` : undefined;
};

export const bunTestSelection = (
  cases: QuarantinedTest[],
  packageDir: string,
  platform: string,
  quarantine: boolean,
  runner = "bun",
  paths?: string[],
) => {
  const selected = cases.filter((entry) => {
    if (entry.runner !== runner || !entry.file.startsWith(`${packageDir}/`)) return false;
    if (!paths?.length) return true;
    const file = relative(packageDir, entry.file).replaceAll("\\", "/");
    return paths.some((path) => {
      const clean = path.replaceAll("\\", "/").replace(/^\.\//, "").replace(/\/$/, "");
      return file === clean || file.startsWith(`${clean}/`);
    });
  });
  const pattern = quarantinePattern(selected, runner, platform);
  return {
    cases: selected.filter((entry) => matchesPlatform(entry, platform, process.arch)),
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

// The stable lane keeps excluding registered cases while a caller selects a subset by name.
export const narrowStablePattern = (stable: string | undefined, filter: string) =>
  stable ? `(?=.*(?:${filter}))${stable}` : filter;

export const quarantineDirectory = (root: string, runner: string, owner: string) =>
  resolve(root, "test-results/quarantine", runner, owner);
const browserReports: Record<string, string> = {
  playwright: "packages/e2e/test-results/packaged-browser-quarantine/results.json",
  "playwright-ui": "packages/e2e/test-results/ui-quarantine/results.json",
  "packaged-desktop": "clients/desktop/test-results/packaged-quarantine-readiness.json",
  "packaged-desktop-benchmark": "clients/desktop/test-results/packaged-benchmarks-quarantine.json",
};
export const browserQuarantineReportPath = (runner: string) => {
  const path = browserReports[runner];
  if (!path) throw new Error("Unknown browser quarantine runner");
  return resolve(fileURLToPath(new URL("../../", import.meta.url)), path);
};

export const playwrightQuarantineSelection = (
  runner: string,
  testDirectory: string,
  quarantine: boolean,
  platform = process.platform,
  arch = process.arch,
) => {
  const selected = quarantineRegistry.filter(
    (entry) => entry.runner === runner && matchesPlatform(entry, platform, arch),
  );
  const files = selected.map((entry) => relative(testDirectory, entry.file).replaceAll("\\", "/"));
  const alternatives = selected.map((entry, index) => {
    const file = files[index]!.split("/").map(escapeRegex).join("[\\\\/]");
    return `(?:^| )${file} (?:.* )?${escapeRegex(entry.name)}(?:\\s+@\\S+)*$`;
  });
  const pattern = new RegExp(alternatives.join("|") || "(?!)");
  return {
    ...(quarantine
      ? {
          grep: pattern,
          testMatch: files,
          maxFailures: 0,
          retries: 0,
          repeatEach: 1,
          metadata: { quarantineAttempt: process.env.CI_QUARANTINE_ATTEMPT },
        }
      : { grepInvert: pattern }),
  };
};
