import { strict as assert } from "node:assert";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestCronDriver } from "pstdio-scheduler/testing";
import { createTestApp } from "../../test-utils/create-test-app";
import { assignDeviceAutomation, openDeviceAutomations, setDeviceAutomationEnabled } from "./device-automations";
import { replicateRecords } from "./device-automations.fixture";
import { loadExtensionSource } from "./extension-runtime";
import { openAutomationRuns } from "./extension-schedule-admission/runs";
import { createExtensionScheduler } from "./extension-scheduler";
import { createTestExtensionSource } from "./test-utils/create-test-extension-source";

// Run inside bun run dev:isolated. These app owners use independent durable databases.
const root = await mkdtemp(join(tmpdir(), "assigned-device-integration-"));
const apps: Awaited<ReturnType<typeof createTestApp>>[] = [];
const schedulers: ReturnType<typeof createExtensionScheduler>[] = [];
const calls: unknown[] = [];
(globalThis as Record<string, unknown>).__assignedDeviceCalls = calls;
const projectId = crypto.randomUUID();
const scheduleId = "test.clock.schedule.tick";
const startApp = async (name: string) => {
  const app = await createTestApp({ databasePath: join(root, `${name}.db`), storageRoot: join(root, name) });
  apps.push(app);
  return app;
};
try {
  const source = createTestExtensionSource({ root, installName: "clock", name: "clock", displayName: "Clock" });
  await writeFile(
    join(source, "extension.ts"),
    `export default {
    commands: [{ id: "tick", ref: { kind: "command", id: "tick" }, title: "Tick", run(ctx) {
      globalThis.__assignedDeviceCalls.push(ctx.invocation.metadata);
    }}],
    schedules: [{ id: "tick", disabled: true, ref: { kind: "schedule", id: "tick" }, title: "Tick",
      schedule: "* * * * *", command: { kind: "command", id: "tick" } }],
  };`,
  );
  const loaded = await loadExtensionSource(source);
  let a = await startApp("a");
  const b = await startApp("b");
  for (const app of [a, b]) {
    await app.deps.projectService.create({ id: projectId, name: "Shared clock" });
    await app.deps.workspaceService.ensureDefault({ project_id: projectId, name: "Local", root_path: root });
    await app.deps.extensionService.enableInstalledSourceForProject({
      projectId,
      sourcePath: source,
      extensionId: loaded.metadata.id,
      installName: "clock",
      name: "clock",
      displayName: "Clock",
      manifest: loaded.manifest,
    });
    app.deps.extensionRuntimeCatalog.invalidate({ projectId, reason: "source_changed" });
  }
  const { environmentId: deviceId } = await a.deps.environmentService.get();
  // Future injected time keeps the app's normal wall clock scheduler separate from this scenario.
  const start = Math.ceil(Date.now() / 60_000) * 60_000 + 86_400_000;
  let now = new Date(start);
  await assignDeviceAutomation(a.deps, projectId, { scheduleId, deviceId }, now);
  const instanceId = (await a.deps.extensionService.listProjectExtensionInstances(projectId))[0]!.instance.id;
  await setDeviceAutomationEnabled(a.deps, projectId, { scheduleId, instanceId, enabled: true });
  const catalog = await openDeviceAutomations(a.deps, projectId);
  const replica = await openDeviceAutomations(b.deps, projectId);
  await replicateRecords(catalog, replica);
  await replicateRecords(catalog, replica);
  const clockFor = async (app: typeof a, name: string) => {
    const cron = createTestCronDriver();
    const scheduler = createExtensionScheduler({
      deps: app.deps,
      listProjectIds: async () => [projectId],
      cron: cron.factory,
      now: () => now,
      watermarkPath: join(root, `${name}-watermarks.json`),
    });
    schedulers.push(scheduler);
    await scheduler.refresh();
    return { scheduler, cron };
  };
  const owner = await clockFor(a, "a");
  const other = await clockFor(b, "b");
  assert.equal(owner.cron.size(), 1);
  assert.equal(other.cron.size(), 0);
  now = new Date(start + 60_000);
  await owner.cron.fireAll();
  await owner.cron.fireAll();
  await other.cron.fireAll();
  assert.equal(calls.length, 1);
  await owner.scheduler.dispose();
  await a.close();
  apps.splice(apps.indexOf(a), 1);
  now = new Date(start + 4 * 60_000);
  await other.cron.fireAll();
  assert.equal(calls.length, 1);
  a = await startApp("a");
  // Startup provisions restored workspaces asynchronously. Begin clock assertions after
  // its ready event, so a provisioning change cannot deliberately close final admission.
  while (
    !a.deps.eventBus
      .getSince(0)
      .some(
        (event) =>
          event.table === "workspaces" &&
          (event.data as { project_id?: string; initializing?: boolean }).project_id === projectId &&
          (event.data as { initializing?: boolean }).initializing === false,
      )
  )
    await Bun.sleep(10);
  const restarted = await clockFor(a, "a");
  assert.equal(restarted.cron.size(), 1);
  await restarted.cron.fireAll();
  assert.equal(calls.length, 1);
  now = new Date(start + 5 * 60_000);
  await restarted.cron.fireAll();
  assert.equal(calls.length, 2);
  const runs = (await (await openAutomationRuns(a.deps, projectId)).records.list("run:")).map(
    (r) => r.value as { status: string },
  );
  assert.equal(runs.filter((r) => r.status === "skipped").length, 3);
  assert.equal(runs.filter((r) => r.status === "completed").length, 2);
  assert.deepEqual(await a.deps.sessionService.list(projectId), []);
  assert.deepEqual(await b.deps.sessionService.list(projectId), []);
  assert.deepEqual(await (await openAutomationRuns(b.deps, projectId)).records.list("run:"), []);
  console.log(
    "PASS: two durable isolated runtimes, only A dispatches, A off leaves B idle, duplicate delivery, durable restart, three skipped misses, no replay and local history.",
  );
} finally {
  await Promise.all(schedulers.map((s) => s.dispose()));
  await Promise.all(apps.map((app) => app.close()));
  delete (globalThis as Record<string, unknown>).__assignedDeviceCalls;
  await rm(root, { recursive: true, force: true });
}
