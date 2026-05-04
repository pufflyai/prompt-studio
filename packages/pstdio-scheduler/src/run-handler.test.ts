import { describe, expect, test } from "bun:test";
import { startActiveRun } from "./run-handler";
import type { Job, RunContext } from "./types";

const job: Job = {
  key: "demo/key",
  cron: "* * * * *",
  timeoutMs: 50,
  meta: { foo: "bar" },
};

const ctx = (): RunContext => ({
  runId: "run-1",
  scheduledFor: new Date("2026-04-20T09:00:00.000Z"),
  reason: "live",
});

const captureLogger = () => {
  const events: { level: "info" | "error"; payload: Record<string, unknown>; msg?: string }[] = [];
  return {
    events,
    info: (payload: Record<string, unknown>, msg?: string) => events.push({ level: "info", payload, msg }),
    error: (payload: Record<string, unknown>, msg?: string) => events.push({ level: "error", payload, msg }),
  };
};

describe("startActiveRun", () => {
  test("logs success with structured payload after handler resolves", async () => {
    const logger = captureLogger();

    const run = startActiveRun({
      job,
      ctx: ctx(),
      runJob: async () => {},
      logger,
    });

    await run.completion;
    await run.awaitableForShutdown;

    const event = logger.events.at(0);
    expect(event?.level).toBe("info");
    expect(event?.payload).toMatchObject({
      event: "scheduler.run",
      jobKey: "demo/key",
      runId: "run-1",
      scheduledFor: "2026-04-20T09:00:00.000Z",
      reason: "live",
      outcome: "success",
      meta: { foo: "bar" },
    });
  });

  test("swallows handler errors and logs outcome=error", async () => {
    const logger = captureLogger();

    const run = startActiveRun({
      job,
      ctx: ctx(),
      runJob: async () => {
        throw new Error("boom");
      },
      logger,
    });

    await run.completion;
    await run.awaitableForShutdown;

    const event = logger.events.at(0);
    expect(event?.level).toBe("error");
    expect(event?.payload.outcome).toBe("error");
    expect((event?.payload.err as Error).message).toBe("boom");
  });

  test("emits timed_out event when handler exceeds timeoutMs but does not raise", async () => {
    const logger = captureLogger();
    const blocker = Promise.withResolvers<void>();

    const run = startActiveRun({
      job: { ...job, timeoutMs: 20 },
      ctx: ctx(),
      runJob: () => blocker.promise,
      logger,
    });

    await run.awaitableForShutdown;
    expect(logger.events.at(0)?.payload.outcome).toBe("timed_out");

    blocker.resolve();
    await run.completion;

    // Original handler completion does not log a second event after timeout.
    expect(logger.events.length).toBe(1);
  });
});
