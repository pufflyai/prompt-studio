import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { appendFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { bunRunIdentity } from "./bun-test-evidence";
import { desktopBenchmarkResults } from "./desktop-benchmark-results";
import { matchesPlatform, quarantineDirectory, quarantineRegistry } from "./test-quarantine";

const root = resolve(import.meta.dir, "../..");
const cwd = join(root, "clients/desktop");
const files = process.argv.slice(2).map((file) => file.replace(/^\.\//, ""));
if (files.some((file) => !/^(?:\.\/)?src\/e2e\/[\w.-]+\.bench\.ts$/.test(file)) || new Set(files).size !== files.length)
  throw new Error("Choose each desktop benchmark file once; execution flags are not allowed");
const command = ["x", "--no-install", "playwright", "test", "--config", "playwright.benchmark.config.ts", ...files];
// Retain the focused quarantine runner for diagnosis; normal CI uses the ordered complete execution below.
if (process.env.E2E_TEST_LANE === "quarantine") {
  const child = spawnSync(process.execPath, command, { cwd, stdio: "inherit" });
  process.exit(child.status ?? 1);
}
const runner = "packaged-desktop-benchmark";
const expected = quarantineRegistry.filter(
  (entry) =>
    entry.runner === runner &&
    matchesPlatform(entry, process.platform, process.arch) &&
    (!files.length || files.some((file) => entry.file === `clients/desktop/${file.replace(/^\.\//, "")}`)),
);
const directory = quarantineDirectory(root, runner, "clients/desktop");
const reportPath = join(cwd, "test-results/packaged-benchmarks.json");
const quarantinePath = join(cwd, "test-results/packaged-benchmarks-quarantine.json");
rmSync(directory, { recursive: true, force: true });
rmSync(reportPath, { force: true });
rmSync(quarantinePath, { force: true });
mkdirSync(directory, { recursive: true });
const token = randomUUID();
writeFileSync(join(directory, "attempt.json"), JSON.stringify({ ...bunRunIdentity(root), token }));
const child = spawnSync(process.execPath, command, {
  cwd,
  stdio: "inherit",
  env: { ...process.env, E2E_TEST_LANE: "benchmark", CI_QUARANTINE_ATTEMPT: token },
});
if (child.error || child.signal || ![0, 1].includes(child.status!)) throw new Error("Desktop benchmark runner failed");
const report = JSON.parse(readFileSync(reportPath, "utf8"));
if (report.config.metadata?.quarantineAttempt !== token) throw new Error("Stale desktop benchmark report");
const result = desktopBenchmarkResults(report, expected, root);
writeFileSync(quarantinePath, JSON.stringify(result.quarantineReport));
const summary = `${result.executed} desktop benchmarks executed once in original order; ${result.stableFailures.length} stable failures; ${result.quarantined.failures}/${result.quarantined.executed} quarantined failures.\n`;
console.log(summary.trim());
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
// A nonzero runner exit without any case failure is an infrastructure failure.
process.exitCode = result.stableFailures.length || (child.status !== 0 && !result.quarantined.failures) ? 1 : 0;
