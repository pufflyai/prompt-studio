import { expect, test } from "bun:test";
import { join } from "node:path";
import { createTestCronDriver } from "pstdio-scheduler/testing";
import { assignDeviceAutomation, openDeviceAutomations } from "../device-automations";
import { createDeviceAutomationFixture } from "../device-automations.fixture";
import { openAutomationRuns } from "../extension-schedule-admission/runs";
import { createExtensionScheduler } from "../extension-scheduler";

for (const assigned of [false, true]) {
  for (const event of ["none", "extension_automation_preferences", "workspaces", "same-project-automation"] as const) {
    test(`${assigned ? "assigned" : "local"} schedule survives unrelated ${event} event during preparation`, async () => {
      const fixture = await createDeviceAutomationFixture();
      const { deps } = await fixture.device();
      let now = new Date("2026-10-22T09:00:00Z");
      if (assigned) {
        await assignDeviceAutomation(
          deps,
          fixture.projectId,
          {
            scheduleId: fixture.scheduleId,
            deviceId: (await deps.environmentService.get()).environmentId,
          },
          now,
        );
      } else {
        deps.accountService.projectSyncStatus = async () => ({ state: "local", offlineReady: false });
      }
      const calls: unknown[] = [];
      (globalThis as Record<string, unknown>).__deviceAutomationRun = async () => {
        calls.push(true);
      };
      const clock = createTestCronDriver();
      const scheduler = createExtensionScheduler({
        deps,
        listProjectIds: async () => [fixture.projectId],
        cron: clock.factory,
        now: () => now,
        watermarkPath: join(fixture.root, "review.json"),
      });
      const gate = Promise.withResolvers<void>();
      try {
        await scheduler.refresh();
        const prepared = Promise.withResolvers<void>();
        deps.workspaceService.getDefault = async () => {
          prepared.resolve();
          await gate.promise;
          return null;
        };
        now = new Date("2026-10-22T09:01:00Z");
        const running = clock.fireAll();
        await prepared.promise;
        if (event === "same-project-automation") {
          await (await openDeviceAutomations(deps, fixture.projectId)).records.commit({
            operationId: crypto.randomUUID(),
            edits: [
              {
                recordId: "other-schedule",
                replace: {
                  scheduleId: "other-schedule",
                  deviceId: "other-device",
                  enabled: false,
                  startsAt: now.toISOString(),
                },
              },
            ],
          });
        } else if (event !== "none")
          deps.eventBus.emit(event, "set", {
            id: "unrelated-record",
            project_id: "unrelated-project",
            automation_id: "unrelated-schedule",
            extension_instance_id: "unrelated-extension",
            enabled: false,
          });
        gate.resolve();
        await running;
        const runs = (await (await openAutomationRuns(deps, fixture.projectId)).records.list("run:")).map(
          (r) => r.value,
        );
        if (assigned) expect(runs).toEqual([expect.objectContaining({ status: "completed" })]);
        expect(calls).toHaveLength(1);
      } finally {
        gate.resolve();
        await scheduler.dispose();
        await fixture.close();
      }
    });
  }
}

for (const change of ["source-disable", "workspace-location", "source-edit", "source-noop"] as const) {
  test(`an assigned schedule rejects its own ${change} change during preparation`, async () => {
    const fixture = await createDeviceAutomationFixture();
    const { deps } = await fixture.device();
    let now = new Date("2026-10-22T09:00:00Z");
    await assignDeviceAutomation(
      deps,
      fixture.projectId,
      {
        scheduleId: fixture.scheduleId,
        deviceId: (await deps.environmentService.get()).environmentId,
      },
      now,
    );
    let workspace = {
      id: "workspace",
      project_id: fixture.projectId,
      execution_kind: "local",
      root_path: fixture.root,
    };
    const prepared = Promise.withResolvers<void>();
    const gate = Promise.withResolvers<void>();
    deps.workspaceService.getDefault = async () => {
      const result = workspace;
      prepared.resolve();
      await gate.promise;
      return result as never;
    };
    const calls: unknown[] = [];
    (globalThis as Record<string, unknown>).__deviceAutomationRun = async () => {
      calls.push(true);
    };
    const clock = createTestCronDriver();
    const scheduler = createExtensionScheduler({
      deps,
      listProjectIds: async () => [fixture.projectId],
      cron: clock.factory,
      now: () => now,
      watermarkPath: join(fixture.root, "own-change.json"),
    });
    try {
      await scheduler.refresh();
      now = new Date("2026-10-22T09:01:00Z");
      const running = clock.fireAll();
      await prepared.promise;
      if (change === "source-disable") {
        deps.extensionService.listEnabledSourcesForProject = async () => [];
        deps.extensionRuntimeCatalog.invalidate({ projectId: fixture.projectId, reason: "enablement_changed" });
      } else if (change === "source-edit" || change === "source-noop") {
        const snapshot = await deps.extensionRuntimeCatalog.get(fixture.projectId);
        const extension = snapshot.runtime.extensions[0]!;
        if (change === "source-edit") {
          const code = await Bun.file(extension.sourcePath).text();
          await Bun.write(
            extension.sourcePath,
            code.replace("await globalThis", "await Promise.resolve(); await globalThis"),
          );
        }
        deps.extensionRuntimeCatalog.invalidate({ sourcePath: extension.packagePath, reason: "source_changed" });
      } else {
        workspace = { ...workspace, root_path: join(fixture.root, "other-location") };
        deps.eventBus.emit("workspaces", "set", workspace);
      }
      gate.resolve();
      await running;
      expect(calls).toHaveLength(change === "source-noop" ? 1 : 0);
      const runs = await (await openAutomationRuns(deps, fixture.projectId)).records.list("run:");
      expect(runs.map((r) => r.value)).toEqual([
        expect.objectContaining({ status: change === "source-noop" ? "completed" : "skipped" }),
      ]);
    } finally {
      gate.resolve();
      await scheduler.dispose();
      await fixture.close();
    }
  });
}
