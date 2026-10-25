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
