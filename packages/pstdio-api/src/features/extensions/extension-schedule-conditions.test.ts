import { afterEach, expect, test } from "bun:test";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { createTestCronDriver } from "pstdio-scheduler/testing";
import { createExtensionScheduler } from "./extension-scheduler";
import {
  createDeps,
  createScheduleStorage,
  createTempRoot,
  tempRoots,
  waitFor,
  writeScheduledExtension,
} from "./extension-scheduler.fixture";

const schedulers: Array<{ dispose: () => Promise<void> }> = [];
afterEach(async () => {
  await Promise.all(schedulers.splice(0).map((scheduler) => scheduler.dispose()));
  delete (globalThis as Record<string, unknown>).__extensionScheduleState;
  for (const root of tempRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const fixture = (enabled = false, userEnabled?: boolean) => {
  const storage = createScheduleStorage();
  storage.values.set("project-1/mode", { enabled });
  const state = { calls: [] as unknown[] };
  (globalThis as Record<string, unknown>).__extensionScheduleState = state;
  const cron = createTestCronDriver();
  let now = new Date("2026-05-18T07:56:15.000Z");
  const input = {
    deps: createDeps(
      writeScheduledExtension({ conditional: true }),
      userEnabled === undefined
        ? []
        : [
            {
              extension_instance_id: "instance-1",
              automation_id: "pstdio.lab.schedule.heartbeat",
              enabled: userEnabled,
            },
          ],
      storage,
    ),
    listProjectIds: async () => ["project-1"],
    watermarkPath: join(createTempRoot(), "watermarks.json"),
    now: () => now,
    cron: cron.factory,
  };
  const start = () => {
    const scheduler = createExtensionScheduler(input);
    schedulers.push(scheduler);
    return scheduler;
  };
  return {
    storage,
    state,
    cron,
    start,
    tick: () => {
      now = new Date(now.getTime() + 60_000);
    },
  };
};

test("only arms a conditional schedule while its saved mode is on, including after restart", async () => {
  const { start, storage, cron, state, tick } = fixture();
  const scheduler = start();
  await scheduler.refresh();
  expect(cron.size()).toBe(0);
  storage.values.set("project-1/mode", { enabled: true });
  for (const listener of storage.listeners) listener({ workbenchId: "project-1", extensionId: "pstdio.lab" });
  await waitFor(() => cron.size() === 1);
  await cron.fireAll();
  expect(state.calls).toHaveLength(1);
  tick();
  await scheduler.dispose();
  const restarted = start();
  await restarted.refresh();
  expect(cron.size()).toBe(1);
  storage.values.set("project-1/mode", { enabled: false });
  for (const listener of storage.listeners) listener({ workbenchId: "project-1", extensionId: "pstdio.lab" });
  await waitFor(() => cron.size() === 0);
  expect(restarted.activity()).toEqual([]);
});

test("rechecks saved mode before invoking a tick that races with disabling", async () => {
  const { start, storage, cron, state } = fixture(true);
  const scheduler = start();
  await scheduler.refresh();
  expect(cron.size()).toBe(1);
  storage.values.set("project-1/mode", { enabled: false });
  await cron.fireAll();
  expect(state.calls).toEqual([]);
});

test("a project cannot enable another project's schedule", async () => {
  const { start, storage, cron } = fixture();
  storage.values.set("project-2/mode", { enabled: true });
  const scheduler = start();
  await scheduler.refresh();
  expect(cron.size()).toBe(0);
});

test("the saved mode and user preference must both allow the schedule", async () => {
  const disabledByUser = fixture(true, false);
  await disabledByUser.start().refresh();
  expect(disabledByUser.cron.size()).toBe(0);
  const disabledByMode = fixture(false, true);
  await disabledByMode.start().refresh();
  expect(disabledByMode.cron.size()).toBe(0);
});
