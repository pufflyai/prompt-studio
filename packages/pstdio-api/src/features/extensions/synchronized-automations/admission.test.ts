import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestCronDriver } from "pstdio-scheduler/testing";
import { createTestApp } from "../../../test-utils/create-test-app";
import { loadExtensionSource } from "../extension-runtime";
import { createExtensionScheduler } from "../extension-scheduler";
import { createTestExtensionSource } from "../test-utils/create-test-extension-source";
import { assignAutomation, openAutomationCatalog } from "./catalog";
import { createCatalogRelayFixture } from "./relay.fixture";

test("assignment during local dispatch preparation cannot use the old default workspace or bypass a claim", async () => {
  const root = await mkdtemp(join(tmpdir(), "automation-admission-"));
  const app = await createTestApp();
  const cron = createTestCronDriver();
  let scheduler: ReturnType<typeof createExtensionScheduler> | undefined;
  const entered = Promise.withResolvers<void>();
  const gate = Promise.withResolvers<void>();
  try {
    const project = await app.deps.projectService.create({ name: "Clock" });
    await app.deps.workspaceService.ensureDefault({ project_id: project.id, name: "Default", root_path: root });
    await mkdir(join(root, "target"));
    const target = await app.deps.workspaceService.create({
      project_id: project.id,
      shorthand_base: "clock",
      root_path: join(root, "target"),
    });
    const source = createTestExtensionSource({ root, installName: "clock", name: "clock", displayName: "Clock" });
    await writeFile(
      join(source, "extension.ts"),
      `export default {
      commands: [{ id: "tick", ref: { kind: "command", id: "tick" }, title: "Tick", async run(ctx) {
        await ctx.storage.set("dispatched", true);
      }}],
      schedules: [{ id: "tick", ref: { kind: "schedule", id: "tick" }, title: "Tick", schedule: "0 0 29 2 *",
        command: { kind: "command", id: "tick" } }],
    };`,
    );
    const loaded = await loadExtensionSource(source);
    const installed = await app.deps.extensionService.enableInstalledSourceForProject({
      projectId: project.id,
      sourcePath: source,
      extensionId: loaded.metadata.id,
      installName: "clock",
      name: "clock",
      displayName: "Clock",
      manifest: loaded.manifest,
    });
    app.deps.extensionRuntimeCatalog.invalidate({ projectId: project.id, reason: "source_changed" });
    const now = new Date("2028-02-29T00:00:00.000Z");
    scheduler = createExtensionScheduler({
      deps: app.deps,
      listProjectIds: async () => [project.id],
      watermarkPath: join(root, "watermarks.json"),
      now: () => now,
      cron: cron.factory,
    });
    await scheduler.refresh();
    const getDefault = app.deps.workspaceService.getDefault;
    let pause = true;
    app.deps.workspaceService.getDefault = async (id) => {
      if (pause) {
        pause = false;
        entered.resolve();
        await gate.promise;
      }
      return getDefault(id);
    };
    const running = cron.fireAll();
    await entered.promise;
    const catalog = await openAutomationCatalog(app.deps, project.id);
    await assignAutomation(
      app.deps,
      project.id,
      { scheduleId: "test.clock.schedule.tick", workspaceId: target.id },
      new Date("2028-02-28T23:59:00.000Z"),
    );
    await catalog.synchronize(createCatalogRelayFixture(project.id));
    await scheduler.refresh();
    gate.resolve();
    await running;
    const dispatched = await app.deps.extensionStorageService.getKv(
      { extension_instance_id: installed.instance.id, scope_type: "project", scope_id: project.id },
      "dispatched",
    );
    expect(dispatched).toBeNull();
  } finally {
    gate.resolve();
    await scheduler?.dispose();
    await app.close();
    await rm(root, { recursive: true, force: true });
  }
});
