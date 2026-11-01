import { expect, test } from "bun:test";
import type { CiJob } from "./ci-failures";
import { summarizeCiHealth, summarizeCiTiming } from "./ci-timing";

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

test("does not count skipped or missing first attempts as passing", () => {
  const summary = summarizeCiTiming([
    job({ event: "pull_request", branch: "feature/example", conclusion: "skipped" }),
    job({ runId: 2, attempt: 2, event: "pull_request" }),
    job({ runId: 3, event: "pull_request" }),
  ]);
  expect(summary.runs.map((run) => [run.stage, run.firstAttemptSucceeded])).toEqual([
    ["pull_request", false],
    ["pull_request", false],
    ["pull_request", true],
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
    job({ workflow: "release-packages.yml", name: "production / functional / production_ci_passed" }),
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

test("a skipped job without timestamps does not hide the run duration", () => {
  const report = summarizeCiTiming([
    job({ name: "scope", id: 1, started: "2026-10-25T00:00:05Z", completed: "2026-10-25T00:00:30Z" }),
    job({ name: "build_docker", id: 3, conclusion: "skipped", started: null, completed: null }),
    job({ id: 4, started: "2026-10-25T00:00:30Z", completed: "2026-10-25T00:01:00Z" }),
  ]);
  expect(report.runs[0]).toMatchObject({ wallMs: 60_000, elapsedAfterStartMs: 55_000 });
});

test("health compares each stage with its target and counts queue runs, reruns and runner time", () => {
  const minute = (offset: number) => new Date(Date.parse("2026-10-25T00:00:00Z") + offset * 60_000).toISOString();
  const queue = (runId: number, minutes: number, patch: Partial<CiJob> = {}) =>
    job({
      runId,
      event: "merge_group",
      branch: `gh-readonly-queue/main/pr-${runId}`,
      sha: `sha-${runId}`,
      runCreated: minute(0),
      created: minute(0),
      started: minute(0),
      completed: minute(minutes),
      ...patch,
    });
  const jobs = [
    queue(1, 5),
    queue(2, 7),
    queue(3, 12, { conclusion: "failure" }),
    queue(3, 12, { id: 8, name: "database_tests", conclusion: "failure" }),
    queue(3, 18, { id: 9, attempt: 2, name: "database_tests", started: minute(13) }),
    job({
      runId: 4,
      event: "pull_request",
      branch: "feature",
      runCreated: minute(0),
      started: minute(0),
      completed: minute(2),
    }),
  ];
  const runs = [1, 2, 3].map((id) => ({
    id,
    workflow: "test-and-build.yml",
    head_sha: `sha-${id}`,
    head_branch: "queue",
    event: "merge_group",
    created_at: minute(0),
    run_attempt: id === 3 ? 2 : 1,
  }));
  const health = summarizeCiHealth(summarizeCiTiming(jobs), jobs, runs, 2);
  expect(health.stages.find((stage) => stage.stage === "merge_queue")).toEqual({
    stage: "merge_queue",
    targetMs: 480_000,
    runs: 3,
    measured: 3,
    p50Ms: 420_000,
    p90Ms: 720_000,
    withinTarget: 2,
    firstAttemptFailures: 1,
    runnerMinutes: 36,
  });
  expect(health.stages.find((stage) => stage.stage === "pull_request")).toMatchObject({
    p50Ms: 120_000,
    withinTarget: 1,
  });
  expect(health).toMatchObject({ queueRuns: 4, mergedPulls: 2, queueRunsPerMerge: 2, failedJobs: 1, passedOnRerun: 1 });
});
