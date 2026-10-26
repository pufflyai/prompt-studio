import { expect, test } from "bun:test";
import { type CiJob, deduplicateJobs, parseFailedTests, summarizeFailures } from "./ci-failures";

const excerpt = `2026-10-13T13:03:33.509Z @pstdio/desktop: ::group::src/release/notarize-macos.p0.test.ts:
2026-10-13T13:03:33.518Z @pstdio/desktop: \u001b[31m✗\u001b[0m native command execution retains numeric failure status and both output streams [4.78ms]
2026-10-13T12:41:00.182Z   1) src\\e2e\\packaged-navigation-customization.p2.spec.ts:74:1 › restores navigation after relaunch
2026-10-13T12:41:00.183Z     Error: browser context closed
2026-10-13T12:41:00.184Z src/packaged/harness-npm-detection.p2.test.ts:
2026-10-13T12:41:00.185Z (fail) returns no models and stops every hanging version probe [4000.00ms]`;

const job = (changes: Partial<CiJob> = {}): CiJob => ({
  workflow: "test-and-build.yml",
  runId: 10,
  attempt: 1,
  sha: "commit",
  branch: "main",
  event: "push",
  name: "desktop / win32-x64",
  id: 100,
  conclusion: "failure",
  started: "2026-10-13T01:00:00Z",
  completed: "2026-10-13T01:10:00Z",
  failedSteps: ["Smoke packaged app"],
  ...changes,
});

test("extracts Bun and Playwright failures from saved prefixed job output", () => {
  expect(parseFailedTests(excerpt)).toEqual([
    "bun | @pstdio/desktop | src/release/notarize-macos.p0.test.ts | native command execution retains numeric failure status and both output streams",
    "playwright | src/e2e/packaged-navigation-customization.p2.spec.ts | restores navigation after relaunch",
    "bun | src/packaged/harness-npm-detection.p2.test.ts | returns no models and stops every hanging version probe",
  ]);
});

test("extracts Playwright project titles and keeps distinct tagged cases", () => {
  expect(
    parseFailedTests(
      "  2) [chromium] › src/ui/setup.spec.ts:3:2 › opens setup @essential (retry #1)\n  3) src/ui/setup.spec.ts:3:2 › opens setup @other",
    ),
  ).toEqual([
    "playwright | src/ui/setup.spec.ts | opens setup @essential",
    "playwright | src/ui/setup.spec.ts | opens setup @other",
  ]);
});

test("ignores Bun's repeated failure summary after a later file header", () => {
  const log = `##[group]clients\\desktop\\src\\cli\\user-cli-setup.test.ts:
(fail) a new bash shell finds pst after setup [7.46ms]
##[endgroup]
##[group]clients\\desktop\\src\\performance\\performance-endpoint.p0.test.ts:
(pass) preserves an active owner [3.0ms]
1 tests failed:
(fail) a new bash shell finds pst after setup [7.46ms]`;
  expect(parseFailedTests(log)).toEqual([
    "bun | clients/desktop/src/cli/user-cli-setup.test.ts | a new bash shell finds pst after setup",
  ]);
});

test("deduplicates jobs copied across attempts without merging distinct runs", () => {
  const first = job({ conclusion: "success" });
  expect(
    deduplicateJobs([first, job({ id: 101, attempt: 2, conclusion: "success" }), job({ id: 102, runId: 11 })]),
  ).toEqual([first, job({ id: 102, runId: 11 })]);
});

test("does not collapse queued jobs without execution timestamps", () => {
  const jobs = [job({ started: null, completed: null }), job({ id: 101, started: null, completed: null })];
  expect(deduplicateJobs(jobs)).toEqual(jobs);
});

test("counts main and release failures and only later same-commit passes as reruns", () => {
  const jobs = [
    job({ failures: ["test failure"] }),
    job({ id: 101, attempt: 2, conclusion: "success", started: "2026-10-13T02:00:00Z" }),
    job({ runId: 11, id: 102, workflow: "release-packages.yml", branch: "release", failures: ["test failure"] }),
  ];
  expect(summarizeFailures(jobs).failures).toEqual([
    { signature: "test failure", count: 2, branches: ["main", "release"], main: 1, release: 1, passedOnRerun: 1 },
  ]);
  expect(summarizeFailures(jobs).mainFirstAttempts).toEqual({ total: 1, failed: 1 });
});

test("excludes summary jobs and earlier passing runs from rerun counts", () => {
  const jobs = [
    job({ failures: ["test failure"] }),
    job({ runId: 9, id: 99, conclusion: "success", completed: "2026-10-12T01:10:00Z" }),
    ...["ci_passed", "version_pr", "nightly_prune", "desktop / targets"].map((name, i) => job({ id: 200 + i, name })),
  ];
  const summary = summarizeFailures(jobs);
  expect(summary.failures).toHaveLength(1);
  expect(summary.failures[0]?.passedOnRerun).toBe(0);
});

test("groups failed steps even when the job log names a failing test", () => {
  const summary = summarizeFailures([job({ failures: ["test failure"] })]);
  expect(summary.steps).toEqual([
    {
      signature: "step | desktop / win32-x64 | Smoke packaged app",
      count: 1,
      branches: ["main"],
      main: 1,
      release: 0,
      passedOnRerun: 0,
    },
  ]);
});
