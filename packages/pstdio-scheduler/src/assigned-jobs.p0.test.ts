import { expect, test } from "bun:test";
import { createScheduler } from "./create-scheduler";
import { createTestCronDriver } from "./testing";
import { toMinuteEpoch } from "./watermark-store";

test("a job can skip catch-up and keep its occurrence ID visible after disarming", async () => {
  const clock = createTestCronDriver();
  const gate = Promise.withResolvers<void>();
  const contexts: unknown[] = [];
  let enabled = true;
  let now = new Date("2026-10-22T09:03:00Z");
  const scheduler = createScheduler({
    cron: clock.factory,
    now: () => now,
    watermarks: {
      load: async () => new Map([["assigned", toMinuteEpoch(new Date("2026-10-22T09:00:00Z"))]]),
      save: async () => {},
    },
    listJobs: async () =>
      enabled
        ? [
            {
              key: "assigned",
              label: "Clock",
              description: "Project",
              cron: "* * * * *",
              timeoutMs: 1_000,
              catchup: "skip",
              runId: (date) => `occurrence:${date.toISOString()}`,
            },
          ]
        : [],
    runJob: async (_job, context) => {
      contexts.push(context);
      await gate.promise;
    },
  });
  try {
    await scheduler.refresh();
    expect(contexts).toEqual([]);
    now = new Date("2026-10-22T09:04:00Z");
    const running = clock.fireAll();
    await Promise.resolve();
    enabled = false;
    await scheduler.refresh();
    expect(clock.size()).toBe(0);
    expect(scheduler.activity()).toEqual([
      { id: "occurrence:2026-10-22T09:04:00.000Z", label: "Clock", description: "Project" },
    ]);
    gate.resolve();
    await running;
    expect(scheduler.activity()).toEqual([]);
  } finally {
    gate.resolve();
    await scheduler.dispose();
  }
});
