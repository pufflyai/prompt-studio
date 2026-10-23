import { afterEach, expect, test } from "bun:test";
import { join } from "node:path";
import { createTestCronDriver } from "pstdio-scheduler/testing";
import {
  assignDeviceAutomation,
  openDeviceAutomations,
  readDeviceAutomation,
  setDeviceAutomationEnabled,
} from "./device-automations";
import { createDeviceAutomationFixture, replicateRecords } from "./device-automations.fixture";
import { openAutomationRuns } from "./extension-schedule-admission/runs";
import { createExtensionScheduler } from "./extension-scheduler";
import { createProjectExtensionLifecycle } from "./project-extension-lifecycle";

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});

test("a disable overlapping first assignment remains disabled", async () => {
  const fixture = await createDeviceAutomationFixture();
  cleanup.push(fixture.close);
  const { deps } = await fixture.device();
  const snapshot = await deps.extensionRuntimeCatalog.get(fixture.projectId);
  const source = snapshot.enabledSources[0]!;
  const preferences: { extension_instance_id: string; automation_id: string; enabled: boolean }[] = [];
  const read = Promise.withResolvers<void>();
  const resume = Promise.withResolvers<void>();
  deps.extensionAutomationPreferencesService.list = async () => {
    const captured = [...preferences];
    read.resolve();
    await resume.promise;
    return captured as never;
  };
  deps.extensionAutomationPreferencesService.set = async (input) => {
    preferences.push(input);
    return input as never;
  };
  deps.extensionService.getProjectExtensionInstance = async () => source;
  const lifecycle = createProjectExtensionLifecycle(deps as never);
  const assignment = assignDeviceAutomation(deps, fixture.projectId, {
    scheduleId: fixture.scheduleId,
    deviceId: "assigned-device",
  });
  await read.promise;
  const disable = lifecycle.setAutomationEnabled(fixture.projectId, "clock", fixture.scheduleId, false);
  await new Promise<void>((resolve) => setImmediate(resolve));
  resume.resolve();
  await Promise.all([assignment, disable]);
  expect(await readDeviceAutomation(deps, fixture.projectId, fixture.scheduleId)).toMatchObject({
    deviceId: "assigned-device",
    enabled: false,
  });
});

test("replicated automation runs only on its assigned device and a disable lets active work finish", async () => {
  const fixture = await createDeviceAutomationFixture();
  cleanup.push(fixture.close);
  const a = await fixture.device();
  const b = await fixture.device();
  const { projectId, scheduleId } = fixture;
  const { environmentId: deviceId } = await a.deps.environmentService.get();
  let now = new Date("2026-10-22T09:00:00Z");
  await assignDeviceAutomation(a.deps, projectId, { scheduleId, deviceId }, now);
  const catalogs = await Promise.all([
    openDeviceAutomations(a.deps, projectId),
    openDeviceAutomations(b.deps, projectId),
  ]);
  await replicateRecords(catalogs[0]!, catalogs[1]!);
  const gate = Promise.withResolvers<void>();
  const calls: unknown[] = [];
  (globalThis as Record<string, unknown>).__deviceAutomationRun = async (meta: unknown) => {
    calls.push(meta);
    await gate.promise;
  };
  const clocks = [createTestCronDriver(), createTestCronDriver()];
  const schedulers = [a, b].map((app, index) =>
    createExtensionScheduler({
      deps: app.deps,
      listProjectIds: async () => [projectId],
      cron: clocks[index]!.factory,
      now: () => now,
      watermarkPath: join(fixture.root, `${index}.json`),
    }),
  );
  cleanup.push(async () => {
    gate.resolve();
    await Promise.all(schedulers.map((s) => s.dispose()));
  });
  await Promise.all(schedulers.map((s) => s.refresh()));
  expect(clocks.map((c) => c.size())).toEqual([1, 0]);
  now = new Date("2026-10-22T09:01:00Z");
  const running = clocks[0]!.fireAll();
  for (let i = 0; !calls.length && i < 100; i++) await Bun.sleep(10);
  expect(calls).toHaveLength(1);
  expect(calls[0]).toMatchObject({ runId: schedulers[0]!.activity()[0]!.id });
  await setDeviceAutomationEnabled(b.deps, projectId, { scheduleId, instanceId: "clock", enabled: false });
  await replicateRecords(catalogs[1]!, catalogs[0]!);
  await schedulers[0]!.refresh();
  expect(clocks[0]!.size()).toBe(0);
  expect(schedulers[0]!.activity()).toHaveLength(1);
  gate.resolve();
  await running;
  expect(schedulers[0]!.activity()).toHaveLength(0);
  await clocks[1]!.fireAll();
  expect(calls).toHaveLength(1);
  await expect(assignDeviceAutomation(b.deps, projectId, { scheduleId, deviceId: "other" })).rejects.toThrow(
    "assigned",
  );
});

test("offline device misses are recorded without catch-up and duplicate delivery or restart cannot replay runs", async () => {
  const fixture = await createDeviceAutomationFixture();
  cleanup.push(fixture.close);
  const a = await fixture.device();
  const b = await fixture.device();
  const { projectId, scheduleId } = fixture;
  const { environmentId: deviceId } = await a.deps.environmentService.get();
  await assignDeviceAutomation(a.deps, projectId, { scheduleId, deviceId }, new Date("2026-10-22T09:00:00Z"));
  const catalog = await openDeviceAutomations(a.deps, projectId);
  const replica = await openDeviceAutomations(b.deps, projectId);
  await replicateRecords(catalog, replica);
  await replicateRecords(catalog, replica);
  const calls: unknown[] = [];
  (globalThis as Record<string, unknown>).__deviceAutomationRun = async (meta: unknown) => {
    calls.push(meta);
  };
  let now = new Date("2026-10-22T09:03:30Z");
  const start = async (app: typeof a, name: string) => {
    const clock = createTestCronDriver();
    const scheduler = createExtensionScheduler({
      deps: app.deps,
      listProjectIds: async () => [projectId],
      cron: clock.factory,
      now: () => now,
      watermarkPath: join(fixture.root, name),
    });
    cleanup.push(scheduler.dispose);
    await scheduler.refresh();
    return { clock, scheduler };
  };
  const nonOwner = await start(b, "b.json");
  await nonOwner.clock.fireAll();
  expect(nonOwner.clock.size()).toBe(0);
  const first = await start(a, "a.json");
  expect(calls).toHaveLength(0);
  const history = async () =>
    (await (await openAutomationRuns(a.deps, projectId)).records.list("run:")).map((r) => r.value);
  expect(await history()).toHaveLength(3);
  expect(await history()).toEqual(expect.arrayContaining([expect.objectContaining({ status: "skipped" })]));
  now = new Date("2026-10-22T09:04:00Z");
  await first.clock.fireAll();
  await first.clock.fireAll();
  expect(calls).toHaveLength(1);
  await first.scheduler.dispose();
  const second = await start(a, "a.json");
  await second.clock.fireAll();
  expect(calls).toHaveLength(1);
  now = new Date("2026-10-22T09:07:00Z");
  await second.clock.fireAll();
  expect(calls).toHaveLength(2);
  expect(await history()).toHaveLength(7);
});

test("a disable during workspace preparation prevents final command dispatch", async () => {
  const fixture = await createDeviceAutomationFixture();
  cleanup.push(fixture.close);
  const a = await fixture.device();
  const { projectId, scheduleId } = fixture;
  const { environmentId: deviceId } = await a.deps.environmentService.get();
  let now = new Date("2026-10-22T09:00:00Z");
  await assignDeviceAutomation(a.deps, projectId, { scheduleId, deviceId }, now);
  const prepared = Promise.withResolvers<void>();
  const gate = Promise.withResolvers<void>();
  const getDefault = a.deps.workspaceService.getDefault;
  a.deps.workspaceService.getDefault = async (id) => {
    prepared.resolve();
    await gate.promise;
    return getDefault(id);
  };
  const calls: unknown[] = [];
  (globalThis as Record<string, unknown>).__deviceAutomationRun = async () => {
    calls.push(true);
  };
  const clock = createTestCronDriver();
  const scheduler = createExtensionScheduler({
    deps: a.deps,
    listProjectIds: async () => [projectId],
    cron: clock.factory,
    now: () => now,
    watermarkPath: join(fixture.root, "race.json"),
  });
  cleanup.push(async () => {
    gate.resolve();
    await scheduler.dispose();
  });
  await scheduler.refresh();
  now = new Date("2026-10-22T09:01:00Z");
  const running = clock.fireAll();
  await prepared.promise;
  await setDeviceAutomationEnabled(a.deps, projectId, { scheduleId, instanceId: "clock", enabled: false });
  gate.resolve();
  await running;
  expect(calls).toEqual([]);
  const records = await (await openAutomationRuns(a.deps, projectId)).records.list("run:");
  expect(records.map((record) => record.value)).toEqual([expect.objectContaining({ status: "skipped" })]);
});

test("concurrent initial assignments cannot replace the assigned device", async () => {
  const fixture = await createDeviceAutomationFixture();
  cleanup.push(fixture.close);
  const { deps } = await fixture.device();
  const results = await Promise.allSettled(
    ["a", "b"].map((deviceId) =>
      assignDeviceAutomation(deps, fixture.projectId, {
        scheduleId: fixture.scheduleId,
        deviceId,
      }),
    ),
  );
  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
  const record = await (await openDeviceAutomations(deps, fixture.projectId)).records.read(fixture.scheduleId);
  expect(record.value).toMatchObject({ deviceId: "a" });
});

test("local schedules keep running when workspace startup finishes during preparation", async () => {
  const fixture = await createDeviceAutomationFixture();
  cleanup.push(fixture.close);
  const { deps } = await fixture.device();
  deps.accountService.projectSyncStatus = async () => ({ state: "local", offlineReady: false });
  const calls: unknown[] = [];
  (globalThis as Record<string, unknown>).__deviceAutomationRun = async () => {
    calls.push(true);
  };
  const cron = createTestCronDriver();
  const scheduler = createExtensionScheduler({
    deps,
    listProjectIds: async () => [fixture.projectId],
    cron: cron.factory,
    now: () => new Date("2026-10-22T09:00:00Z"),
    watermarkPath: join(fixture.root, "local.json"),
  });
  cleanup.push(scheduler.dispose);
  await scheduler.refresh();
  deps.workspaceService.getDefault = async () => {
    deps.eventBus.emit("workspaces", "set", { project_id: fixture.projectId, initializing: false });
    return null;
  };
  await cron.fireAll();
  expect(calls).toHaveLength(1);
});

test("a local run cannot use stale admission after becoming assigned during preparation", async () => {
  const fixture = await createDeviceAutomationFixture();
  cleanup.push(fixture.close);
  const { deps } = await fixture.device();
  deps.accountService.projectSyncStatus = async () => ({ state: "local", offlineReady: false });
  const calls: unknown[] = [];
  (globalThis as Record<string, unknown>).__deviceAutomationRun = async () => {
    calls.push(true);
  };
  const cron = createTestCronDriver();
  const scheduler = createExtensionScheduler({
    deps,
    listProjectIds: async () => [fixture.projectId],
    cron: cron.factory,
    now: () => new Date("2026-10-22T09:00:00Z"),
    watermarkPath: join(fixture.root, "local-assigned.json"),
  });
  cleanup.push(scheduler.dispose);
  await scheduler.refresh();
  deps.workspaceService.getDefault = async () => {
    await assignDeviceAutomation(deps, fixture.projectId, {
      scheduleId: fixture.scheduleId,
      deviceId: (await deps.environmentService.get()).environmentId,
    });
    return null;
  };
  await cron.fireAll();
  expect(calls).toEqual([]);
});
