import { expect, test } from "bun:test";
import type { CiJob } from "./ci-failures";
import { summarizeCiTiming } from "./ci-timing";

const job = (patch: Partial<CiJob> = {}): CiJob => ({
  workflow: "test-and-build.yml",
  runId: 1,
  attempt: 1,
  sha: "sha",
  branch: "main",
  event: "push",
  name: "ci_passed",
  id: 2,
  conclusion: "success",
  failedSteps: [],
  runCreated: "2026-10-25T00:00:00Z",
  created: "2026-10-25T00:00:03Z",
  started: "2026-10-25T00:00:05Z",
  completed: "2026-10-25T00:01:00Z",
  ...patch,
});

test("measures first-attempt wall and runner wait from distinct timestamps", () => {
  const summary = summarizeCiTiming([
    job({
      steps: [
        { name: "Install dependencies", started: "2026-10-25T00:00:05Z", completed: "2026-10-25T00:00:15Z" },
        { name: "Run tests", started: "2026-10-25T00:00:15Z", completed: "2026-10-25T00:00:35Z" },
        { name: "Unknown phase", started: "2026-10-25T00:00:35Z", completed: "2026-10-25T00:00:40Z" },
      ],
    }),
    job({ id: 3, attempt: 2, conclusion: "success" }),
  ]);
  expect(summary.runs[0]).toMatchObject({
    stage: "main",
    wallMs: 60_000,
    firstAttemptSucceeded: true,
    jobs: [
      {
        id: 2,
        runnerWaitMs: 2_000,
        phases: { setup: 10_000, test: 20_000, unclassified: 5_000 },
        cause: { kind: "unclassified", evidence: [] },
      },
    ],
  });
});

test("does not count skipped or missing first attempts as passing or mix unknown PR scopes", () => {
  const summary = summarizeCiTiming([
    job({ event: "pull_request", branch: "feature/example", conclusion: "skipped" }),
    job({ runId: 2, attempt: 2, event: "pull_request" }),
    job({ runId: 3, event: "pull_request", fullOverride: false }),
    job({ runId: 4, event: "pull_request", fullOverride: true }),
  ]);
  expect(summary.runs.map((run) => [run.stage, run.firstAttemptSucceeded])).toEqual([
    ["pull_request-unclassified", false],
    ["pull_request-unclassified", false],
    ["pull_request", true],
    ["pull_request-full", true],
  ]);
});

test("keeps action-required runs with no jobs in the first-attempt inventory", () => {
  const report = summarizeCiTiming(
    [],
    [
      {
        id: 12,
        workflow: "test-and-build.yml",
        head_sha: "sha",
        head_branch: "main",
        event: "push",
        created_at: "2026-10-25T00:00:00Z",
      },
    ],
  );
  expect(report.runs[0]).toMatchObject({
    runId: 12,
    firstAttemptSucceeded: false,
    missingFirstAttempt: true,
    wallMs: null,
    initialWaitMs: null,
    elapsedAfterStartMs: null,
    totalRunnerMs: null,
  });
});

test("does not certify a cancelled first run even when its gate had completed", () => {
  const report = summarizeCiTiming(
    [job()],
    [
      {
        id: 1,
        workflow: "test-and-build.yml",
        head_sha: "sha",
        head_branch: "main",
        event: "push",
        created_at: "2026-10-25T00:00:00Z",
        run_attempt: 1,
        conclusion: "cancelled",
      },
    ],
  );
  expect(report.runs[0].firstAttemptSucceeded).toBe(false);
});

test("separates initial scheduling delay from execution and does not sum parallel jobs into stage duration", () => {
  const report = summarizeCiTiming([
    job({ name: "scope", id: 1, started: "2026-10-25T00:10:00Z", completed: "2026-10-25T00:10:10Z" }),
    job({ name: "checks", id: 2, started: "2026-10-25T00:10:10Z", completed: "2026-10-25T00:12:50Z" }),
    job({ name: "parallel", id: 3, started: "2026-10-25T00:10:10Z", completed: "2026-10-25T00:12:40Z" }),
    job({ id: 4, started: "2026-10-25T00:12:50Z", completed: "2026-10-25T00:13:00Z" }),
  ]);
  expect(report.runs[0]).toMatchObject({
    wallMs: 780_000,
    initialWaitMs: 600_000,
    elapsedAfterStartMs: 180_000,
    totalRunnerMs: 330_000,
  });
});

test("release timing includes publication after its nested functional gate", () => {
  const report = summarizeCiTiming([
    job({ workflow: "release-packages.yml", name: "production / functional / ci_passed" }),
    job({
      workflow: "release-packages.yml",
      name: "publish",
      id: 3,
      started: "2026-10-25T00:03:00Z",
      completed: "2026-10-25T00:08:00Z",
    }),
  ]);
  expect(report.runs[0]).toMatchObject({ wallMs: 480_000, initialWaitMs: 5_000, elapsedAfterStartMs: 475_000 });
});
