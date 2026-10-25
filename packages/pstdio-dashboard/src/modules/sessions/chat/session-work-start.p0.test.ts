import { expect, test } from "bun:test";
import { hasPendingSessionRunStarted, resolveSessionWorkStartedAt } from "./session-work-start";

const runStart = "2026-10-01T12:00:00.000Z";
const submittedAt = Date.parse("2026-10-01T12:05:00.000Z");
const pending = { submittedAt, previousRunStarted: runStart };

test("anchors elapsed work to the server's current run", () => {
  expect(resolveSessionWorkStartedAt(runStart)).toBe(Date.parse(runStart));
});

test("anchors a pending follow-up to its submission until the server starts the new run", () => {
  expect(resolveSessionWorkStartedAt(runStart, pending)).toBe(submittedAt);
  expect(resolveSessionWorkStartedAt(null, { submittedAt, previousRunStarted: null })).toBe(submittedAt);
  const nextRun = "2026-10-01T12:05:01.000Z";
  expect(resolveSessionWorkStartedAt(nextRun, pending)).toBe(Date.parse(nextRun));
});

test("has no elapsed work anchor before a run or submission exists", () => {
  expect(resolveSessionWorkStartedAt(null)).toBeUndefined();
});

test("keeps the current run anchor while a follow-up is queued during work", () => {
  expect(resolveSessionWorkStartedAt(runStart, pending, true)).toBe(Date.parse(runStart));
});

test("keeps a pending run until the server timestamp replaces its submission time", () => {
  expect(hasPendingSessionRunStarted(null, runStart)).toBe(false);
  expect(hasPendingSessionRunStarted(runStart, runStart)).toBe(false);
  expect(hasPendingSessionRunStarted("2026-10-01T12:05:01.000Z", runStart)).toBe(true);
});

test("acknowledges a new server run when the browser clock is ahead", () => {
  const nextRun = "2026-10-01T12:01:00.000Z";
  expect(hasPendingSessionRunStarted(nextRun, runStart)).toBe(true);
  expect(resolveSessionWorkStartedAt(nextRun, pending)).toBe(Date.parse(nextRun));
  expect(hasPendingSessionRunStarted(runStart, runStart)).toBe(false);
});
