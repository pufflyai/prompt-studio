import { expect, test } from "bun:test";
import { qualifyRequiredTurnaround } from "./required-turnaround";

const run = {
  id: 1,
  head_sha: "candidate",
  event: "merge_group",
  run_attempt: 1,
  created_at: "2026-11-14T00:00:00Z",
  conclusion: "success",
};
const jobs = [
  {
    name: "scope",
    conclusion: "success",
    created_at: run.created_at,
    started_at: "2026-11-14T00:00:30Z",
    completed_at: "2026-11-14T00:01:00Z",
    steps: [],
  },
  {
    name: "ci_passed",
    conclusion: "success",
    created_at: "2026-11-14T00:09:00Z",
    started_at: "2026-11-14T00:09:10Z",
    completed_at: "2026-11-14T00:09:59Z",
    steps: [],
  },
];
test("qualification includes runner waits and gate cleanup in the ten-minute ceiling", () => {
  const report = qualifyRequiredTurnaround(run, jobs, "cold");
  expect(report.qualified).toBe(true);
  expect(report.elapsedMs).toBe(599_000);
  expect(report.runnerWaitMs).toBe(40_000);
  expect(
    qualifyRequiredTurnaround(run, [{ ...jobs[1]!, completed_at: "2026-11-14T00:10:01Z" }], "warm").qualified,
  ).toBe(false);
});
test("reruns, incomplete jobs and missing cache provenance cannot qualify", () => {
  expect(qualifyRequiredTurnaround({ ...run, run_attempt: 2 }, jobs, "warm").qualified).toBe(false);
  expect(qualifyRequiredTurnaround(run, [{ ...jobs[1]!, completed_at: null }], "cold").qualified).toBe(false);
  expect(qualifyRequiredTurnaround(run, jobs).qualified).toBe(false);
});
