import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { appendFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { browserBenchmarkResults } from "./browser-benchmark-results";
import { bunRunIdentity } from "./bun-test-evidence";
import { matchesPlatform, quarantineDirectory, quarantineRegistry } from "./test-quarantine";

/** Run the complete workload once; classify its first-attempt report without repeating failed cases. */
export const runOrderedBrowserBenchmarks = (input: {
  root: string;
  cwd: string;
  owner: string;
  runner: string;
  label: string;
  files: string[];
  command: string[];
  reportPath: string;
  quarantinePath: string;
}) => {
  const expected = quarantineRegistry.filter(
    (entry) =>
      entry.runner === input.runner &&
      matchesPlatform(entry, process.platform, process.arch) &&
      (!input.files.length || input.files.includes(entry.file)),
  );
  const directory = quarantineDirectory(input.root, input.runner, input.owner);
  rmSync(directory, { recursive: true, force: true });
  rmSync(input.reportPath, { force: true });
  rmSync(input.quarantinePath, { force: true });
  mkdirSync(directory, { recursive: true });
  const token = randomUUID();
  writeFileSync(join(directory, "attempt.json"), JSON.stringify({ ...bunRunIdentity(input.root), token }));
  const child = spawnSync(process.execPath, input.command, {
    cwd: input.cwd,
    stdio: "inherit",
    env: { ...process.env, CI_PRIORITY: "P3", E2E_TEST_LANE: "benchmark", CI_QUARANTINE_ATTEMPT: token },
  });
  if (child.error || child.signal || ![0, 1].includes(child.status!))
    throw new Error("Browser benchmark runner failed");
  const report = JSON.parse(readFileSync(input.reportPath, "utf8"));
  if (report.config.metadata?.quarantineAttempt !== token) throw new Error("Stale browser benchmark report");
  const result = browserBenchmarkResults(report, expected, input.root);
  writeFileSync(input.quarantinePath, JSON.stringify(result.quarantineReport));
  const summary = `${result.executed} ${input.label} benchmarks executed once in original order; ${result.stableFailures.length} stable failures; ${result.quarantined.failures}/${result.quarantined.executed} quarantined failures.\n`;
  console.log(summary.trim());
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  // A runner failure without a failed case is still an infrastructure failure.
  return result.stableFailures.length || (child.status !== 0 && !result.quarantined.failures) ? 1 : 0;
};
