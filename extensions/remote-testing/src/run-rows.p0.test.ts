import { expect, test } from "bun:test";
import type { Environment } from "./environments";
import { environmentValues, runValues } from "./run-rows";
import type { RunRecord } from "./runs";

const record: RunRecord = {
  runId: "1b2c3d4e-0000-4000-8000-000000000000",
  environmentId: "aa11bb22-0000-4000-8000-000000000000",
  requestId: "r",
  conversationId: "c",
  command: "bun run test",
  root: "/repo",
  startedAt: "2026-11-18T10:00:00.000Z",
  timeoutSeconds: 3600,
  sessionId: "s1",
};

test("a running run shows its elapsed time and the session that started it", () => {
  expect(runValues(record, "Fix login", new Date("2026-11-18T10:01:30.000Z"))).toEqual({
    status: "running",
    command: "bun run test",
    session: "Fix login",
    environment: "aa11bb22",
    started: "2026-11-18T10:00:00.000Z",
    duration: 90,
    exitCode: null,
    log: "",
  });
});

test("a finished run shows its result and log, and names sessions it cannot find", () => {
  const finished: RunRecord = {
    ...record,
    summary: {
      runId: record.runId,
      environmentId: record.environmentId,
      status: "failed",
      exitCode: 1,
      durationMs: 42_400,
      logPath: "/repo/run.log",
      tail: "",
    },
  };
  expect(runValues(finished, null, new Date())).toMatchObject({
    status: "failed",
    session: "Session s1",
    duration: 42,
    exitCode: 1,
    log: "/repo/run.log",
  });
  const { sessionId: _, ...outside } = record;
  // Runs from before sessions were recorded, or started by hand, have no session.
  expect(runValues(outside, null, new Date()).session).toBe("Not recorded");
});

test("an environment shows the run holding it and whether its template is current", () => {
  const environment = {
    id: "aa11bb22-0000-4000-8000-000000000000",
    state: "ready",
    created_at: "2026-11-18T09:00:00.000Z",
    deadline_at: "2026-11-18T17:00:00.000Z",
    template: { name: "remote-tests", version: "1.0.0-old" },
  } as Environment;
  expect(environmentValues(environment, record.runId, "1.0.0-new")).toEqual({
    environment: "aa11bb22",
    state: "ready",
    activity: "Running 1b2c3d4e",
    template: "Older (1.0.0-old)",
    started: "2026-11-18T09:00:00.000Z",
    stopsAt: "2026-11-18T17:00:00.000Z",
  });
  expect(environmentValues(environment, null, "1.0.0-old")).toMatchObject({ activity: "Free", template: "Current" });
});
