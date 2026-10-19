import { afterEach, describe, expect, test } from "bun:test";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { createTestCronDriver } from "pstdio-scheduler/testing";
import { createExtensionScheduler } from "./extension-scheduler";
import { createDeps, createTempRoot, tempRoots, waitFor, writeScheduledExtension } from "./extension-scheduler.fixture";

const schedulers: Array<{ dispose: () => Promise<void> }> = [];

afterEach(async () => {
  await Promise.all(schedulers.splice(0).map((scheduler) => scheduler.dispose()));
  delete (globalThis as Record<string, unknown>).__extensionScheduleState;

  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("createExtensionScheduler", () => {
  test("runs extension schedule commands with schedule metadata", async () => {
    const sourcePath = writeScheduledExtension();
    const state = { calls: [] as Array<{ source?: string; metadata?: Record<string, unknown>; params?: unknown }> };
    (globalThis as Record<string, unknown>).__extensionScheduleState = state;

    const now = new Date("2026-05-18T07:56:15.000Z");
    const cron = createTestCronDriver();
    const scheduler = createExtensionScheduler({
      deps: createDeps(sourcePath),
      listProjectIds: async () => ["project-1"],
      watermarkPath: join(createTempRoot(), "extension-schedule-watermarks.json"),
      now: () => now,
      cron: cron.factory,
    });
    schedulers.push(scheduler);

    await waitFor(() => cron.size() === 1);
    void cron.fireAll();

    await waitFor(() => state.calls.length === 1);
    expect(state.calls[0]).toMatchObject({
      source: "schedule",
      params: { from: "schedule" },
      metadata: {
        reason: "live",
        runId: expect.any(String),
        scheduleId: "pstdio.lab.schedule.heartbeat",
        scheduleTitle: "Heartbeat",
        scheduledFor: "2026-05-18T07:56:00.000Z",
      },
    });
  });

  test("skips schedules the user disabled via automation preferences", async () => {
    const sourcePath = writeScheduledExtension();
    const state = { calls: [] as unknown[] };
    (globalThis as Record<string, unknown>).__extensionScheduleState = state;

    const cron = createTestCronDriver();
    const scheduler = createExtensionScheduler({
      deps: createDeps(sourcePath, [
        { extension_instance_id: "instance-1", automation_id: "pstdio.lab.schedule.heartbeat", enabled: false },
      ]),
      listProjectIds: async () => ["project-1"],
      watermarkPath: join(createTempRoot(), "extension-schedule-watermarks.json"),
      now: () => new Date("2026-05-18T07:56:15.000Z"),
      cron: cron.factory,
    });
    schedulers.push(scheduler);

    await scheduler.refresh();
    expect(cron.size()).toBe(0);
  });

  test("runs author-disabled schedules the user explicitly enabled", async () => {
    const sourcePath = writeScheduledExtension({ scheduleDisabled: true });
    const state = { calls: [] as unknown[] };
    (globalThis as Record<string, unknown>).__extensionScheduleState = state;

    const cron = createTestCronDriver();
    const scheduler = createExtensionScheduler({
      deps: createDeps(sourcePath, [
        { extension_instance_id: "instance-1", automation_id: "pstdio.lab.schedule.heartbeat", enabled: true },
      ]),
      listProjectIds: async () => ["project-1"],
      watermarkPath: join(createTempRoot(), "extension-schedule-watermarks.json"),
      now: () => new Date("2026-05-18T07:56:15.000Z"),
      cron: cron.factory,
    });
    schedulers.push(scheduler);

    await waitFor(() => cron.size() === 1);
    void cron.fireAll();

    await waitFor(() => state.calls.length === 1);
  });
});

test("a schedule never runs in the project folder when its explicit workspace is missing", async () => {
  const sourcePath = writeScheduledExtension({ workspaceId: "removed-workspace" });
  const state = { calls: [] as unknown[] };
  (globalThis as Record<string, unknown>).__extensionScheduleState = state;
  const cron = createTestCronDriver();
  const scheduler = createExtensionScheduler({
    deps: createDeps(sourcePath),
    listProjectIds: async () => ["project-1"],
    watermarkPath: join(createTempRoot(), "watermarks.json"),
    now: () => new Date("2026-05-18T07:56:15.000Z"),
    cron: cron.factory,
  });
  schedulers.push(scheduler);
  await waitFor(() => cron.size() === 1);
  await cron.fireAll();
  expect(state.calls).toEqual([]);
});
