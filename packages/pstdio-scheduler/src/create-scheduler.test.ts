import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createScheduler } from "./create-scheduler";
import { createFileWatermarkStore } from "./file-watermark-store";
import { createTestCronDriver } from "./testing";
import type { Job, Logger, Scheduler } from "./types";
import { toMinuteEpoch } from "./watermark-store";

const tempDirs: string[] = [];
const schedulers: Scheduler[] = [];

const createTempDir = () => {
  const dir = mkdtempSync(join(tmpdir(), "pstdio-scheduler-create-"));
  tempDirs.push(dir);
  return dir;
};

const waitFor = async (condition: () => boolean | Promise<boolean>, timeoutMs = 1_000) => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await condition()) return;
    await Bun.sleep(5);
  }
  throw new Error(`Condition not met within ${timeoutMs}ms`);
};

const captureLogger = () => {
  const events: { level: "info" | "error"; payload: Record<string, unknown> }[] = [];
  const logger: Logger = {
    info: (payload) => events.push({ level: "info", payload }),
    error: (payload) => events.push({ level: "error", payload }),
  };
  return { events, logger };
};

afterEach(async () => {
  await Promise.all(schedulers.map((s) => s.dispose()));
  schedulers.length = 0;

  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempDirs.length = 0;
});

describe("createScheduler diff/sync", () => {
  test("arms cron handles for new jobs and stops removed ones on refresh()", async () => {
    const cron = createTestCronDriver();
    let jobs: Job[] = [{ key: "a", cron: "* * * * *", timeoutMs: 1_000 }];

    const scheduler = createScheduler({
      cron: cron.factory,
      listJobs: async () => jobs,
      runJob: async () => {},
    });
    schedulers.push(scheduler);

    await waitFor(() => cron.size() === 1);

    jobs = [
      { key: "a", cron: "* * * * *", timeoutMs: 1_000 },
      { key: "b", cron: "* * * * *", timeoutMs: 1_000 },
    ];
    await scheduler.refresh();
    expect(cron.size()).toBe(2);

    jobs = [{ key: "b", cron: "* * * * *", timeoutMs: 1_000 }];
    await scheduler.refresh();
    expect(cron.size()).toBe(1);
  });

  test("replaces handle when a job's cron expression changes", async () => {
    const cron = createTestCronDriver();
    let jobs: Job[] = [{ key: "a", cron: "* * * * *", timeoutMs: 1_000 }];
    const stops: string[] = [];

    const wrappedFactory = (cronExpr: string, handler: () => void | Promise<void>) => {
      const handle = cron.factory(cronExpr, handler);
      return {
        stop: () => {
          stops.push(cronExpr);
          handle.stop();
        },
      };
    };

    const scheduler = createScheduler({
      cron: wrappedFactory,
      listJobs: async () => jobs,
      runJob: async () => {},
    });
    schedulers.push(scheduler);

    await waitFor(() => cron.size() === 1);

    jobs = [{ key: "a", cron: "*/5 * * * *", timeoutMs: 1_000 }];
    await scheduler.refresh();
    expect(stops).toContain("* * * * *");
  });
});

describe("createScheduler live firing", () => {
  test("dispatches live runs from the injected cron driver", async () => {
    const cron = createTestCronDriver();
    const fireTimes: string[] = [];
    let now = new Date("2026-04-20T09:00:00.000Z");

    const scheduler = createScheduler({
      cron: cron.factory,
      now: () => now,
      listJobs: async () => [{ key: "demo", cron: "* * * * *", timeoutMs: 1_000 }],
      runJob: async (_job, ctx) => {
        fireTimes.push(`${ctx.scheduledFor.toISOString()}#${ctx.reason}`);
      },
    });
    schedulers.push(scheduler);

    await waitFor(() => cron.size() === 1);

    await cron.fireAll();
    await waitFor(() => fireTimes.length === 1);

    now = new Date("2026-04-20T09:01:00.000Z");
    await cron.fireAll();
    await waitFor(() => fireTimes.length === 2);

    expect(fireTimes).toEqual(["2026-04-20T09:00:00.000Z#live", "2026-04-20T09:01:00.000Z#live"]);
  });

  test("does not stack invocations when handler is still running", async () => {
    const cron = createTestCronDriver();
    const blocker = Promise.withResolvers<void>();
    let starts = 0;

    const scheduler = createScheduler({
      cron: cron.factory,
      now: () => new Date("2026-04-20T09:00:00.000Z"),
      listJobs: async () => [{ key: "demo", cron: "* * * * *", timeoutMs: 1_000 }],
      runJob: async () => {
        starts += 1;
        await blocker.promise;
      },
    });
    schedulers.push(scheduler);

    await waitFor(() => cron.size() === 1);

    const first = cron.fireAll();
    await waitFor(() => starts === 1);

    await cron.fireAll();
    expect(starts).toBe(1);

    blocker.resolve();
    await first;
  });

  test("error in runJob does not propagate to the scheduler", async () => {
    const cron = createTestCronDriver();
    const { events, logger } = captureLogger();

    const scheduler = createScheduler({
      cron: cron.factory,
      now: () => new Date("2026-04-20T09:00:00.000Z"),
      logger,
      listJobs: async () => [{ key: "demo", cron: "* * * * *", timeoutMs: 1_000 }],
      runJob: async () => {
        throw new Error("nope");
      },
    });
    schedulers.push(scheduler);

    await waitFor(() => cron.size() === 1);
    await cron.fireAll();
    await waitFor(() => events.some((e) => e.payload.outcome === "error"));
  });
});

describe("createScheduler catchup", () => {
  test("fires a single catchup for the most recent missed minute on first refresh", async () => {
    const cron = createTestCronDriver();
    const fireReasons: string[] = [];
    const watermarkPath = join(createTempDir(), "watermarks.json");
    writeFileSync(
      watermarkPath,
      `${JSON.stringify({ demo: toMinuteEpoch(new Date("2026-02-01T00:00:00.000Z")) }, null, 2)}\n`,
      "utf8",
    );

    const scheduler = createScheduler({
      cron: cron.factory,
      now: () => new Date("2026-04-20T09:00:00.000Z"),
      watermarks: createFileWatermarkStore(watermarkPath),
      listJobs: async () => [{ key: "demo", cron: "0 0 1 * *", timeoutMs: 1_000 }],
      runJob: async (_job, ctx) => {
        fireReasons.push(`${ctx.scheduledFor.toISOString()}#${ctx.reason}`);
      },
    });
    schedulers.push(scheduler);

    await waitFor(() => fireReasons.length === 1);
    expect(fireReasons[0]).toBe("2026-04-01T00:00:00.000Z#catchup");

    await Bun.sleep(50);
    expect(fireReasons.length).toBe(1);
  });

  test("does not fire catchup when watermark already covers the current minute", async () => {
    const cron = createTestCronDriver();
    const fires: string[] = [];
    const watermarkPath = join(createTempDir(), "watermarks.json");
    writeFileSync(
      watermarkPath,
      `${JSON.stringify({ demo: toMinuteEpoch(new Date("2026-04-20T09:00:00.000Z")) }, null, 2)}\n`,
      "utf8",
    );

    const scheduler = createScheduler({
      cron: cron.factory,
      now: () => new Date("2026-04-20T09:00:30.000Z"),
      watermarks: createFileWatermarkStore(watermarkPath),
      listJobs: async () => [{ key: "demo", cron: "* * * * *", timeoutMs: 1_000 }],
      runJob: async (_job, ctx) => {
        fires.push(ctx.scheduledFor.toISOString());
      },
    });
    schedulers.push(scheduler);

    await Bun.sleep(50);
    expect(fires).toEqual([]);
  });
});

describe("createScheduler watermark persistence", () => {
  test("writes the latest fired minute to disk via the watermark store", async () => {
    const cron = createTestCronDriver();
    const watermarkPath = join(createTempDir(), "watermarks.json");
    let now = new Date("2026-04-20T09:00:00.000Z");
    let runCount = 0;

    const scheduler = createScheduler({
      cron: cron.factory,
      now: () => now,
      watermarks: createFileWatermarkStore(watermarkPath),
      listJobs: async () => [{ key: "demo", cron: "* * * * *", timeoutMs: 1_000 }],
      runJob: async () => {
        runCount += 1;
      },
    });
    schedulers.push(scheduler);

    await waitFor(() => cron.size() === 1);
    await cron.fireAll();
    await waitFor(() => runCount === 1);

    now = new Date("2026-04-20T09:01:00.000Z");
    await cron.fireAll();
    await waitFor(() => runCount === 2);

    await scheduler.dispose();
    schedulers.length = 0;

    const raw = await Bun.file(watermarkPath).text();
    const parsed = JSON.parse(raw) as Record<string, number>;
    expect(parsed.demo).toBe(toMinuteEpoch(new Date("2026-04-20T09:01:00.000Z")));
  });
});

describe("createScheduler dispose", () => {
  test("waits for in-flight runs (subject to timeout) and resolves cleanly", async () => {
    const cron = createTestCronDriver();
    const blocker = Promise.withResolvers<void>();

    const scheduler = createScheduler({
      cron: cron.factory,
      now: () => new Date("2026-04-20T09:00:00.000Z"),
      listJobs: async () => [{ key: "demo", cron: "* * * * *", timeoutMs: 30 }],
      runJob: async () => {
        await blocker.promise;
      },
    });
    schedulers.push(scheduler);

    await waitFor(() => cron.size() === 1);
    void cron.fireAll();
    await Bun.sleep(20);

    const started = Date.now();
    await scheduler.dispose();
    const duration = Date.now() - started;
    schedulers.length = 0;

    expect(duration).toBeLessThan(500);
    blocker.resolve();
  });
});
