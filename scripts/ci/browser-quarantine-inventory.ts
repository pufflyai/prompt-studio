import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { runCiChecks } from "./run-ci-checks";
import type { PlannedRun, TestPlan } from "./test-plan";
import { matchesPlatform, quarantineRegistry, quarantineRunnerForTest } from "./test-quarantine";

export const needsBrowserQuarantineInventory = (run: PlannedRun) =>
  run.runner === "app" && run.lane === "stable" && run.quarantineIds.length > 0;

export const discoverBrowserQuarantineInventory = async (
  root: string,
  directory: string,
  run: PlannedRun,
  env: NodeJS.ProcessEnv,
  signal: AbortSignal,
  inheritProcessGroup?: boolean,
) => {
  // Listing loads declarations without fixtures, servers or browser windows. Grep and sharding
  // must not hide the ordinary cases sharing a file with a registered quarantine case.
  const outcome = await runCiChecks(
    [
      {
        id: `${run.id}-discovery`,
        cwd: join(root, run.cwd),
        command: [
          "bun",
          "x",
          "--no-install",
          "playwright",
          "test",
          ...run.files.map((file) => relative(run.cwd, file)),
          ...(run.smoke ? ["--config", "playwright.smoke.config.ts"] : []),
          "--list",
          "--grep=.*",
          "--grep-invert=(?!)",
          `--reporter=${join(root, "scripts/ci/plan-playwright-reporter.ts")}`,
        ],
      },
    ],
    {
      priority: run.priority,
      signal,
      inheritProcessGroup,
      logDirectory: join(directory, "discovery-logs"),
      env: {
        ...env,
        E2E_HOME: join(directory, "discovery-home"),
        CI_PLAN_SHARD: "1/1",
        CI_PLAN_BROWSER_DISCOVERY: "1",
        CI_PLAN_BROWSER_EVIDENCE: join(directory, "browser-inventory.json"),
      },
    },
  );
  if (outcome.outcome !== "success") throw new Error("Browser quarantine discovery failed");
};

export const browserQuarantineInventory = (directory: string, run: PlannedRun, plan: TestPlan, executionId: string) => {
  if (!needsBrowserQuarantineInventory(run)) return { files: [] as string[], reports: [] as string[] };
  const report = JSON.parse(readFileSync(join(directory, "browser-inventory.json"), "utf8"));
  const cases = report.selection as Array<{ id: string; file: string; title: string }>;
  if (
    report.planDigest !== plan.digest ||
    report.runId !== run.id ||
    report.executionId !== executionId ||
    report.discovery !== true ||
    report.complete !== true ||
    report.shard !== "1/1" ||
    report.errors.length ||
    !cases.length ||
    new Set(cases.map((entry) => entry.id)).size !== cases.length ||
    cases.some((entry) => !run.files.includes(entry.file)) ||
    run.files.some((file) => !cases.some((entry) => entry.file === file))
  )
    throw new Error("Invalid unfiltered browser inventory");
  const expected = quarantineRegistry.filter(
    (entry) =>
      entry.runner === quarantineRunnerForTest(run.runner) &&
      matchesPlatform(entry, run.target.platform, run.target.arch) &&
      run.quarantineIds.includes(`${entry.file}:${entry.name}`),
  );
  const files = run.files.filter((file) =>
    cases
      .filter((entry) => entry.file === file)
      .every((actual) =>
        expected.some(
          (entry) => entry.file === file && (actual.title === entry.name || actual.title.endsWith(` > ${entry.name}`)),
        ),
      ),
  );
  return { files, reports: ["browser-inventory.json"] };
};
