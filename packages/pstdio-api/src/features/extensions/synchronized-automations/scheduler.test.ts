import { afterAll, afterEach, beforeAll, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestCronDriver } from "pstdio-scheduler/testing";
import { createConformanceServices } from "pstdio-sync-contracts/conformance";
import { createTestApp } from "../../../test-utils/create-test-app";
import { loadExtensionSource } from "../extension-runtime";
import { createExtensionScheduler } from "../extension-scheduler";
import { createTestExtensionSource } from "../test-utils/create-test-extension-source";
import { assignAutomation, listAutomations, openAutomationCatalog, setAutomationEnabled } from "./catalog";
import { createCatalogRelayFixture } from "./relay.fixture";

let services: Awaited<ReturnType<typeof createConformanceServices>> | undefined;
beforeAll(async () => {
  if (process.env.SYNC_TEST_DATABASE_URL)
    services = await createConformanceServices(
      process.env.SYNC_TEST_DATABASE_URL,
      process.env.SYNC_TEST_OBJECT_ENDPOINT!,
    );
});
afterAll(async () => {
  await services?.close();
});
const apps: Awaited<ReturnType<typeof createTestApp>>[] = [];
const schedulers: ReturnType<typeof createExtensionScheduler>[] = [];
const roots: string[] = [];
afterEach(async () => {
  const state = (globalThis as Record<string, unknown>).__targetedAutomation as
    | { gate?: { resolve?: () => void } }
    | undefined;
  state?.gate?.resolve?.();
  await Promise.all(schedulers.splice(0).map((scheduler) => scheduler.dispose()));
  await Promise.all(apps.splice(0).map((app) => app.close()));
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
  delete (globalThis as Record<string, unknown>).__targetedAutomation;
});

test("replicated schedules execute only on their target; disable waits for delivery and lets active work finish", async () => {
  const root = await mkdtemp(join(tmpdir(), "automation-target-"));
  roots.push(root);
  const calls: { workspaceId: string; metadata: Record<string, unknown> }[] = [];
  const gate = Promise.withResolvers<void>();
  (globalThis as Record<string, unknown>).__targetedAutomation = { calls, gate };
  const source = createTestExtensionSource({ root, installName: "clock", name: "clock", displayName: "Clock" });
  await writeFile(
    join(source, "extension.ts"),
    `
    export default {
      commands: [{ id: "tick", ref: { kind: "command", id: "tick" }, title: "Tick", async run(ctx) {
        const state = globalThis.__targetedAutomation;
        state.calls.push({ workspaceId: ctx.workspaceId, metadata: ctx.invocation.metadata });
        await state.gate.promise;
      }}],
      schedules: [{ id: "tick", disabled: true, ref: { kind: "schedule", id: "tick" }, title: "Tick", schedule: "* * * * *", command: { kind: "command", id: "tick" } }],
    };
  `,
  );
  const projectId = crypto.randomUUID();
  const loaded = await loadExtensionSource(source);
  for (let index = 0; index < 3; index++) {
    const app = await createTestApp();
    apps.push(app);
    await app.deps.projectService.create({ id: projectId, name: "Shared" });
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
  }
  for (const app of apps) app.deps.extensionRuntimeCatalog.invalidate({ projectId, reason: "source_changed" });
  const [a, b] = apps;
  const target = await b!.deps.workspaceService.getDefault(projectId);
  const scheduleId = "test.clock.schedule.tick";
  const catalogs = await Promise.all(apps.map((app) => openAutomationCatalog(app.deps, projectId)));
  const wire = createCatalogRelayFixture(projectId, services);
  let now = new Date("2026-10-19T09:00:00.000Z");
  await assignAutomation(b!.deps, projectId, { scheduleId, workspaceId: target!.id }, now);
  const assigned = await catalogs[1]!.records.read(JSON.stringify(["definition", scheduleId]));
  await setAutomationEnabled(b!.deps, projectId, scheduleId, assigned.revision, true);
  await catalogs[1]!.synchronize(wire);
  await catalogs[0]!.synchronize(wire);
  await catalogs[2]!.synchronize(wire);
  const clocks = apps.map(() => createTestCronDriver());
  for (const [index, app] of apps.entries()) {
    const scheduler = createExtensionScheduler({
      deps: app.deps,
      listProjectIds: async () => [projectId],
      watermarkPath: join(root, `${index}.json`),
      now: () => now,
      cron: clocks[index]!.factory,
    });
    schedulers.push(scheduler);
    await scheduler.refresh();
  }
  expect(clocks.map((clock) => clock.size())).toEqual([0, 1, 0]);
  now = new Date("2026-10-19T09:01:00.000Z");
  const running = clocks[1]!.fireAll();
  for (let count = 0; calls.length === 0 && count < 100; count++) await Bun.sleep(10);
  expect(calls).toHaveLength(1);
  expect(calls[0]!.workspaceId).toBe(target!.id);
  expect(calls[0]!.metadata.runId).toBe(schedulers[1]!.activity()[0]!.id);
  await clocks[0]!.fireAll();
  await clocks[2]!.fireAll();
  await catalogs[1]!.synchronize(wire);
  await catalogs[0]!.synchronize(wire);
  const record = (await listAutomations(a!.deps, projectId))[0]!;
  await setAutomationEnabled(a!.deps, projectId, scheduleId, record.revision, false);
  await catalogs[0]!.synchronize(wire);
  expect((await listAutomations(a!.deps, projectId))[0]!.delivery).toBe("pending");
  expect(schedulers[1]!.activity()).toHaveLength(1);
  await catalogs[1]!.synchronize(wire);
  await schedulers[1]!.refresh();
  expect(clocks[1]!.size()).toBe(0);
  expect(schedulers[1]!.activity()).toHaveLength(1);
  await catalogs[1]!.synchronize(wire);
  await catalogs[0]!.synchronize(wire);
  expect((await listAutomations(a!.deps, projectId))[0]!.delivery).toBe("applied");
  gate.resolve();
  await running;
  expect(calls).toHaveLength(1);
});

test("missed occurrences are recorded without catch-up and restart cannot redispatch a claimed occurrence", async () => {
  const root = await mkdtemp(join(tmpdir(), "automation-restart-"));
  roots.push(root);
  const app = await createTestApp();
  apps.push(app);
  const project = await app.deps.projectService.create({ name: "Clock" });
  await app.deps.workspaceService.ensureDefault({ project_id: project.id, name: "Default", root_path: root });
  await mkdir(join(root, "target"));
  const workspace = await app.deps.workspaceService.create({
    project_id: project.id,
    shorthand_base: "clock",
    root_path: join(root, "target"),
  });
  const calls: unknown[] = [];
  (globalThis as Record<string, unknown>).__targetedAutomation = { calls, gate: { promise: Promise.resolve() } };
  const source = createTestExtensionSource({ root, installName: "clock", name: "clock", displayName: "Clock" });
  await writeFile(
    join(source, "extension.ts"),
    `export default {
    commands: [{ id: "tick", ref: { kind: "command", id: "tick" }, title: "Tick", async run(ctx) {
      globalThis.__targetedAutomation.calls.push(ctx.invocation.metadata);
    }}],
    schedules: [{ id: "tick", disabled: true, ref: { kind: "schedule", id: "tick" }, title: "Tick", schedule: "* * * * *",
      command: { kind: "command", id: "tick" } }],
  };`,
  );
  const loaded = await loadExtensionSource(source);
  await app.deps.extensionService.enableInstalledSourceForProject({
    projectId: project.id,
    sourcePath: source,
    extensionId: loaded.metadata.id,
    installName: "clock",
    name: "clock",
    displayName: "Clock",
    manifest: loaded.manifest,
  });
  app.deps.extensionRuntimeCatalog.invalidate({ projectId: project.id, reason: "source_changed" });
  const scheduleId = "test.clock.schedule.tick";
  const catalog = await openAutomationCatalog(app.deps, project.id);
  await assignAutomation(
    app.deps,
    project.id,
    { scheduleId, workspaceId: workspace.id },
    new Date("2026-10-19T09:00:00.000Z"),
  );
  await expect(assignAutomation(app.deps, project.id, { scheduleId, workspaceId: workspace.id })).rejects.toThrow(
    "retargeting",
  );
  const assigned = await catalog.records.read(JSON.stringify(["definition", scheduleId]));
  await setAutomationEnabled(app.deps, project.id, scheduleId, assigned.revision, true);
  await catalog.synchronize(createCatalogRelayFixture(project.id, services));
  let now = new Date("2026-10-19T09:03:30.000Z");
  const makeScheduler = async () => {
    const cron = createTestCronDriver();
    const scheduler = createExtensionScheduler({
      deps: app.deps,
      listProjectIds: async () => [project.id],
      watermarkPath: join(root, "watermarks.json"),
      now: () => now,
      cron: cron.factory,
    });
    schedulers.push(scheduler);
    await scheduler.refresh();
    return { scheduler, cron };
  };
  const first = await makeScheduler();
  expect(calls).toEqual([]);
  const runs = await app.app.request(`/v1/projects/${project.id}/automation-targets/runs`);
  expect(runs.status).toBe(200);
  expect(
    ((await runs.json()) as { status: string; scheduledFor: string }[]).map((run) => run.scheduledFor).sort(),
  ).toEqual(["2026-10-19T09:01:00.000Z", "2026-10-19T09:02:00.000Z", "2026-10-19T09:03:00.000Z"]);
  now = new Date("2026-10-19T09:04:00.000Z");
  await first.cron.fireAll();
  await first.cron.fireAll();
  expect(calls).toHaveLength(1);
  expect(calls[0]).toMatchObject({ runId: JSON.stringify([project.id, scheduleId, now.toISOString()]) });
  await first.scheduler.dispose();
  const second = await makeScheduler();
  await second.cron.fireAll();
  expect(calls).toHaveLength(1);
  now = new Date("2026-10-19T09:07:00.000Z");
  await second.cron.fireAll();
  expect(calls).toHaveLength(2);
  const history = (await (await app.app.request(`/v1/projects/${project.id}/automation-targets/runs`)).json()) as {
    status: string;
    scheduledFor: string;
  }[];
  expect(history.filter((run) => run.status === "skipped")).toHaveLength(5);
  expect(await app.deps.sessionService.list(project.id)).toEqual([]);
  await app.deps.workspaceService.softDelete(workspace.id);
  await app.deps.workspaceService.ensureDefault({ project_id: project.id, name: "Replacement", root_path: root });
  now = new Date("2026-10-19T09:08:00.000Z");
  await second.scheduler.refresh();
  await second.cron.fireAll();
  expect(second.cron.size()).toBe(0);
  expect(calls).toHaveLength(2);
});
