import { afterEach, expect, setSystemTime, test } from "bun:test";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import { restartAfterQuotaReset, scheduleQuotaRestart } from "./quota-restart";

afterEach(() => setSystemTime());
const fixture = () => {
  const now = Date.parse("2026-11-17T15:00:00Z");
  setSystemTime(now);
  const resetsAt = new Date(now + 60_000).toISOString();
  const jobs: Array<Record<string, unknown>> = [];
  const replies: unknown[] = [];
  let quotaReads = 0;
  let enabled = true;
  let limited = true;
  let local = true;
  const session = {
    id: "session",
    agent: "example.native.harness.agent",
    status: "failed",
    archived: false,
    lastRequestStarted: new Date(now - 60_000).toISOString(),
    lastRequestEnded: new Date(now).toISOString(),
    lastExit: { cause: "failed" },
  };
  const messages = [
    { id: "user", role: "user", parts: [{ type: "text", text: "Work" }] },
    { id: "error", role: "system", parts: [{ type: "error", errorType: "other", message: "Usage limit exceeded" }] },
  ];
  const ctx = makeCommandContext({
    storage: createMemoryStorage(),
    params: {},
    overrides: {
      sessions: {
        get: async () => session as never,
        getExecutionState: async () => ({ kind: local ? "local" : "remote", available: true }),
        getConversation: async () => ({ session, messages }) as never,
        followup: async (input) => {
          replies.push(input);
          session.status = "in_progress";
        },
      },
      commands: {
        execute: async () => {
          quotaReads++;
          return {
            ok: true,
            status: "success",
            value: {
              status: "available",
              restartAfterQuotaReset: enabled,
              limits: [{ remainingPercent: limited ? 0 : 50, resetsAt }],
            },
          } as never;
        },
      },
      automation: {
        enqueue: async (input) => {
          jobs.push(input);
          return { id: "job" } as never;
        },
      },
    },
  });
  const input = {
    sessionId: session.id,
    harnessId: session.agent,
    startedAt: session.lastRequestStarted,
    endedAt: session.lastRequestEnded,
    notBefore: new Date(now + 75_000).toISOString(),
  };
  return {
    ctx,
    session,
    messages,
    jobs,
    replies,
    input,
    now,
    resetsAt,
    reads: () => quotaReads,
    settings: (next: { enabled?: boolean; limited?: boolean; local?: boolean }) => {
      if (next.enabled !== undefined) enabled = next.enabled;
      if (next.limited !== undefined) limited = next.limited;
      if (next.local !== undefined) local = next.local;
    },
  };
};

test("quota failures enqueue an idempotent restart at reset plus fifteen seconds", async () => {
  const f = fixture();
  expect(await scheduleQuotaRestart(f.ctx, "session")).toBe(true);
  await scheduleQuotaRestart(f.ctx, "session");
  expect(f.jobs[0]).toMatchObject({ notBefore: f.input.notBefore, input: { params: f.input } });
  expect(f.jobs[0]?.key).toBe(f.jobs[1]?.key);
  expect(f.replies).toEqual([]);
});
test("restart does not query quotas or contact the agent before the buffered deadline", async () => {
  const f = fixture();
  setSystemTime(f.now + 74_999);
  expect(await restartAfterQuotaReset(f.ctx, f.input)).toEqual({ restarted: false });
  expect(f.reads()).toBe(0);
  expect(f.replies).toEqual([]);
  f.settings({ limited: false });
  setSystemTime(f.now + 75_000);
  expect(await restartAfterQuotaReset(f.ctx, f.input)).toEqual({ restarted: true });
  expect(f.replies).toHaveLength(1);
  expect(f.replies[0]).toMatchObject({
    expectedRun: { status: "failed", startedAt: f.input.startedAt, endedAt: f.input.endedAt },
  });
  expect(await restartAfterQuotaReset(f.ctx, f.input)).toEqual({ restarted: false });
  expect(f.replies).toHaveLength(1);
});
test("manual stops, changed runs, archives, remote ownership and disabled settings cancel restarts", async () => {
  for (const reason of ["stop", "changed", "archive", "remote", "disabled"]) {
    const f = fixture();
    setSystemTime(f.now + 75_000);
    if (reason === "stop") f.session.lastExit.cause = "user_stop";
    if (reason === "changed") f.session.lastRequestStarted = new Date(f.now + 1).toISOString();
    if (reason === "archive") f.session.archived = true;
    if (reason === "remote") f.settings({ local: false });
    if (reason === "disabled") f.settings({ enabled: false, limited: false });
    expect(await restartAfterQuotaReset(f.ctx, f.input)).toEqual({ restarted: false });
    expect(f.replies).toEqual([]);
  }
});
test("a later quota window postpones restart instead of contacting the agent", async () => {
  const f = fixture();
  const input = { ...f.input, notBefore: new Date(f.now).toISOString() };
  expect(await restartAfterQuotaReset(f.ctx, input)).toEqual({ restarted: false });
  expect(f.jobs[0]?.notBefore).toBe(f.input.notBefore);
  expect(f.replies).toEqual([]);
});
test("unrelated failures and a previous turn's quota error do not schedule work", async () => {
  const f = fixture();
  const error = f.messages[1].parts[0];
  if (!("message" in error)) throw new Error("Expected an error part");
  error.message = "Connection failed";
  expect(await scheduleQuotaRestart(f.ctx, "session")).toBe(false);
  error.message = "Usage limit exceeded";
  f.messages.push({ id: "next", role: "user", parts: [{ type: "text", text: "New work" }] });
  expect(await scheduleQuotaRestart(f.ctx, "session")).toBe(false);
  expect(f.jobs).toEqual([]);
});

test("native quota error wording is recognized only on a failed turn", async () => {
  for (const message of [
    "You've hit your limit · resets 4pm",
    "Too many requests",
    "UsageLimitExceeded",
    "Insufficient credits",
  ]) {
    const f = fixture();
    const error = f.messages[1].parts[0];
    if (!("message" in error)) throw new Error("Expected error");
    error.message = message;
    expect(await scheduleQuotaRestart(f.ctx, "session")).toBe(true);
    f.session.status = "completed";
    expect(await scheduleQuotaRestart(f.ctx, "session")).toBe(false);
  }
});
test("disabled restart never enqueues an agent attempt", async () => {
  const f = fixture();
  f.settings({ enabled: false });
  expect(await scheduleQuotaRestart(f.ctx, "session")).toBe(false);
  expect(f.jobs).toEqual([]);
});
