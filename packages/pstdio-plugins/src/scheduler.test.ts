import { afterEach, describe, expect, test } from "bun:test";
import type { ScheduledTriggerContext } from "@pstdio/sdk/plugins";
import type { ScheduleEntry } from "./scheduler";
import { createScheduler } from "./scheduler";

const makeEntry = (overrides: Partial<ScheduleEntry> = {}): ScheduleEntry => ({
  compositeKey: "plugin-a/sync",
  pluginIdentity: "plugin-a",
  scheduleName: "sync",
  cron: "* * * * *",
  timeoutMs: 30_000,
  trigger: async () => {},
  ...overrides,
});

describe("scheduler - execution", () => {
  let scheduler: ReturnType<typeof createScheduler>;

  afterEach(() => {
    scheduler?.stop();
  });

  test("executes a due schedule entry", async () => {
    const calls: string[] = [];
    const entry = makeEntry({
      trigger: async (ctx: ScheduledTriggerContext) => {
        calls.push(ctx.trigger.scheduleName);
      },
    });

    scheduler = createScheduler({ projectId: "proj-1" });
    scheduler.setEntries([entry]);
    await scheduler.runDueEntries(new Date("2025-01-01T09:00:00Z"));

    expect(calls).toEqual(["sync"]);
  });

  test("passes correct trigger context", async () => {
    let receivedCtx: ScheduledTriggerContext | undefined;
    const entry = makeEntry({
      trigger: async (ctx: ScheduledTriggerContext) => {
        receivedCtx = ctx;
      },
    });

    scheduler = createScheduler({ projectId: "proj-1" });
    scheduler.setEntries([entry]);
    await scheduler.runDueEntries(new Date("2025-01-01T09:00:00Z"));

    expect(receivedCtx).toBeDefined();
    expect(receivedCtx!.projectId).toBe("proj-1");
    expect(receivedCtx!.trigger.type).toBe("schedule");
    expect(receivedCtx!.trigger.scheduleName).toBe("sync");
    expect(receivedCtx!.trigger.scheduledFor).toBe("2025-01-01T09:00:00.000Z");
    expect(receivedCtx!.trigger.runId).toBeDefined();
  });

  test("passes client and prompts from createContext to trigger", async () => {
    let receivedCtx: ScheduledTriggerContext | undefined;
    const fakeClient = { fake: true } as never;
    const fakePrompts = { "my-template": "Hello {{name}}" };

    const entry = makeEntry({
      trigger: async (ctx: ScheduledTriggerContext) => {
        receivedCtx = ctx;
      },
    });

    scheduler = createScheduler({
      projectId: "proj-1",
      createContext: () => ({ client: fakeClient, prompts: fakePrompts }),
    });
    scheduler.setEntries([entry]);
    await scheduler.runDueEntries(new Date("2025-01-01T09:00:00Z"));

    expect(receivedCtx).toBeDefined();
    expect(receivedCtx!.client).toBe(fakeClient);
    expect(receivedCtx!.prompts).toEqual(fakePrompts);
  });

  test("does not re-execute an entry at the same minute", async () => {
    const calls: string[] = [];
    const entry = makeEntry({
      trigger: async () => {
        calls.push("ran");
      },
    });

    scheduler = createScheduler({ projectId: "proj-1" });
    scheduler.setEntries([entry]);

    const t = new Date("2025-01-01T09:00:00Z");
    await scheduler.runDueEntries(t);
    await scheduler.runDueEntries(t);

    expect(calls).toHaveLength(1);
  });

  test("skips execution when previous run is still in flight", async () => {
    const outcomes: string[] = [];
    let resolve: () => void;
    const blocker = new Promise<void>((r) => {
      resolve = r;
    });

    const entry = makeEntry({
      cron: "* * * * *",
      trigger: async () => {
        await blocker;
      },
    });

    scheduler = createScheduler({
      projectId: "proj-1",
      onOutcome: (o) => outcomes.push(o.outcome),
    });
    scheduler.setEntries([entry]);

    const firstRun = scheduler.runDueEntries(new Date("2025-01-01T09:00:00Z"));
    await scheduler.runDueEntries(new Date("2025-01-01T09:01:00Z"));

    expect(outcomes).toContain("skipped_overlap");

    resolve!();
    await firstRun;
  });

  test("times out a long-running handler", async () => {
    const outcomes: string[] = [];
    const entry = makeEntry({
      timeoutMs: 50,
      trigger: async () => {
        await new Promise((r) => setTimeout(r, 5000));
      },
    });

    scheduler = createScheduler({
      projectId: "proj-1",
      onOutcome: (o) => outcomes.push(o.outcome),
    });
    scheduler.setEntries([entry]);
    await scheduler.runDueEntries(new Date("2025-01-01T09:00:00Z"));

    expect(outcomes).toContain("timed_out");
  });

  test("handler failure is isolated from other schedules", async () => {
    const outcomes: string[] = [];

    scheduler = createScheduler({
      projectId: "proj-1",
      onOutcome: (o) => outcomes.push(o.outcome),
    });
    scheduler.setEntries([
      makeEntry({
        compositeKey: "a/fail",
        scheduleName: "fail",
        trigger: async () => {
          throw new Error("boom");
        },
      }),
      makeEntry({
        compositeKey: "b/ok",
        pluginIdentity: "b",
        scheduleName: "ok",
        trigger: async () => {},
      }),
    ]);

    await scheduler.runDueEntries(new Date("2025-01-01T09:00:00Z"));

    expect(outcomes).toContain("failed");
    expect(outcomes).toContain("succeeded");
  });

  test("emits started outcome before execution", async () => {
    const outcomes: string[] = [];
    const entry = makeEntry({ trigger: async () => {} });

    scheduler = createScheduler({
      projectId: "proj-1",
      onOutcome: (o) => outcomes.push(o.outcome),
    });
    scheduler.setEntries([entry]);
    await scheduler.runDueEntries(new Date("2025-01-01T09:00:00Z"));

    expect(outcomes[0]).toBe("started");
    expect(outcomes[1]).toBe("succeeded");
  });

  test("reports structured outcome fields", async () => {
    const outcomes: Array<Record<string, unknown>> = [];
    const entry = makeEntry({ trigger: async () => {} });

    scheduler = createScheduler({
      projectId: "proj-1",
      onOutcome: (o) => outcomes.push(o),
    });
    scheduler.setEntries([entry]);
    await scheduler.runDueEntries(new Date("2025-01-01T09:00:00Z"));

    // started + succeeded
    expect(outcomes).toHaveLength(2);
    const o = outcomes[1]!;
    expect(o.projectId).toBe("proj-1");
    expect(o.pluginIdentity).toBe("plugin-a");
    expect(o.scheduleName).toBe("sync");
    expect(o.outcome).toBe("succeeded");
    expect(typeof o.durationMs).toBe("number");
    expect(typeof o.runId).toBe("string");
    expect(o.scheduledFor).toBeDefined();
  });
});

describe("scheduler - reload and shutdown", () => {
  let scheduler: ReturnType<typeof createScheduler>;

  afterEach(() => {
    scheduler?.stop();
  });

  test("in-flight run completes after entries are replaced", async () => {
    const calls: string[] = [];
    let resolve: () => void;
    const blocker = new Promise<void>((r) => {
      resolve = r;
    });

    const entry = makeEntry({
      trigger: async () => {
        await blocker;
        calls.push("completed");
      },
    });

    scheduler = createScheduler({ projectId: "proj-1" });
    scheduler.setEntries([entry]);

    const runPromise = scheduler.runDueEntries(new Date("2025-01-01T09:00:00Z"));
    scheduler.setEntries([makeEntry({ compositeKey: "plugin-a/new-sync", scheduleName: "new-sync" })]);

    resolve!();
    await runPromise;

    expect(calls).toEqual(["completed"]);
  });

  test("new entries are used on next tick after replacement", async () => {
    const calls: string[] = [];

    scheduler = createScheduler({ projectId: "proj-1" });
    scheduler.setEntries([
      makeEntry({
        trigger: async () => {
          calls.push("old");
        },
      }),
    ]);

    await scheduler.runDueEntries(new Date("2025-01-01T09:00:00Z"));

    scheduler.setEntries([
      makeEntry({
        compositeKey: "plugin-b/new",
        pluginIdentity: "plugin-b",
        scheduleName: "new",
        trigger: async () => {
          calls.push("new");
        },
      }),
    ]);

    await scheduler.runDueEntries(new Date("2025-01-01T09:01:00Z"));

    expect(calls).toEqual(["old", "new"]);
  });

  test("stop prevents new ticks from firing", async () => {
    const calls: string[] = [];
    const entry = makeEntry({
      trigger: async () => {
        calls.push("ran");
      },
    });

    scheduler = createScheduler({ projectId: "proj-1" });
    scheduler.setEntries([entry]);

    await scheduler.runDueEntries(new Date("2025-01-01T09:00:00Z"));
    scheduler.stop();
    await scheduler.runDueEntries(new Date("2025-01-01T09:01:00Z"));

    expect(calls).toHaveLength(1);
  });

  test("stop awaits in-flight runs", async () => {
    const calls: string[] = [];
    let resolve: () => void;
    const blocker = new Promise<void>((r) => {
      resolve = r;
    });

    const entry = makeEntry({
      trigger: async () => {
        await blocker;
        calls.push("done");
      },
    });

    scheduler = createScheduler({ projectId: "proj-1" });
    scheduler.setEntries([entry]);
    scheduler.runDueEntries(new Date("2025-01-01T09:00:00Z"));

    await new Promise((r) => setTimeout(r, 10));

    const stopPromise = scheduler.stop();
    resolve!();
    await stopPromise;

    expect(calls).toEqual(["done"]);
  });

  test("stop abandons handlers that exceed timeout", async () => {
    const outcomes: string[] = [];
    const entry = makeEntry({
      timeoutMs: 50,
      trigger: async () => {
        await new Promise((r) => setTimeout(r, 5000));
      },
    });

    scheduler = createScheduler({
      projectId: "proj-1",
      onOutcome: (o) => outcomes.push(o.outcome),
    });
    scheduler.setEntries([entry]);
    scheduler.runDueEntries(new Date("2025-01-01T09:00:00Z"));

    await new Promise((r) => setTimeout(r, 10));
    await scheduler.stop();

    expect(outcomes).toContain("timed_out");
  });

  test("stop clears tick loop timer", async () => {
    scheduler = createScheduler({ projectId: "proj-1" });
    scheduler.startTickLoop();

    // Stopping should clear the interval and not throw
    await scheduler.stop();

    // Calling stop again is safe
    await scheduler.stop();
  });
});
