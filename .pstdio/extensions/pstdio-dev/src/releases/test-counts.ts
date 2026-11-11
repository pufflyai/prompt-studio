export interface TestCounts {
  passed: number;
  failed: number;
  skipped: number;
  reports: number;
}

// Count runner summaries, never GitHub job conclusions or individual assertion messages.
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
