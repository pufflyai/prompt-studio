export interface TestCounts {
  passed: number;
  failed: number;
  skipped: number;
  reports: number;
  /** Tests executed in registered quarantine lanes. Absent in history cached before it was tracked. */
  quarantined?: number;
}

export const emptyCounts = (): TestCounts => ({ passed: 0, failed: 0, skipped: 0, reports: 0, quarantined: 0 });

// Count runner summaries, never GitHub job conclusions or individual assertion messages.
// Kept self-contained because the runner stringifies it into a separate process.
export const countTests = (log: string) => {
  const counts: TestCounts = { passed: 0, failed: 0, skipped: 0, reports: 0 };
  let pending = false;
  const finish = () => {
    if (pending) counts.reports++;
    pending = false;
  };
  for (const raw of log.split("\n")) {
    const line = raw
      .replace(new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*[A-Za-z]`, "g"), "")
      .replace(/^\S+Z\s/, "");
    const match = line.match(/^\s*(\d+)\s+(pass|fail|skip|passed|failed|skipped|did not run)(?:\s+\([^)]*\))?\s*$/);
    if (match) {
      pending = true;
      const outcome = match[2];
      if (outcome === "pass" || outcome === "passed") counts.passed += Number(match[1]);
      else if (outcome === "fail" || outcome === "failed") counts.failed += Number(match[1]);
      else counts.skipped += Number(match[1]);
      if (outcome === "passed") finish();
    } else if (/^\s*Ran \d+ tests? across /.test(line)) finish();
  }
  finish();
  return counts;
};

export const isTestJob = (name: string) => {
  const leaf = name.split(" / ").at(-1) ?? name;
  return /^(?:package_checks|database_tests_\w+|bun_contracts_\w+|integration_contracts_\w+|components_\w+|e2e_\w+|packaged_and_vite_e2e_\w+|quarantined_\w+|harness-(?:codex|claude-code|open-code|pi)|verify|functional|performance|P3 \w+)\b/.test(
    leaf,
  );
};

export const isQuarantineJob = (name: string) => /^quarantined_\w+/.test(name.split(" / ").at(-1) ?? name);

export const TEST_CATEGORIES = [
  { id: "end-to-end", label: "End-to-end" },
  { id: "components", label: "Components" },
  { id: "backend", label: "Backend" },
  { id: "packages", label: "Packages" },
  { id: "harness", label: "Harness" },
  { id: "performance", label: "Performance" },
  { id: "quarantine", label: "Quarantine" },
] as const;

export type TestCategory = (typeof TEST_CATEGORIES)[number]["id"];
export type TestCategoryCounts = Partial<Record<TestCategory, number>>;

// Every prefix accepted by isTestJob belongs to one of these categories.
export const testJobCategory = (name: string): TestCategory => {
  const leaf = name.split(" / ").at(-1) ?? name;
  if (/^quarantined_/.test(leaf)) return "quarantine";
  if (/^harness-/.test(leaf)) return "harness";
  if (/^(?:performance|P3 )/.test(leaf)) return "performance";
  if (/^(?:package_checks|verify)(?:\s|$)/.test(leaf)) return "packages";
  if (/^(?:database_tests|bun_contracts|integration_contracts)_/.test(leaf)) return "backend";
  if (/^components_/.test(leaf)) return "components";
  return "end-to-end";
};
