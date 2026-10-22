import { expect, test } from "bun:test";
import { join } from "node:path";
import { createTestCronDriver } from "pstdio-scheduler/testing";
import { createNativeAccount } from "../../../services/account/native-account";
import { createDeviceAutomationFixture } from "../device-automations.fixture";
import { createExtensionScheduler } from "../extension-scheduler";

for (const membership of ["local", "cloud", "unknown"] as const) {
  test(`account discovery and logout wake local schedules while ${membership} membership is observed`, async () => {
    const fixture = await createDeviceAutomationFixture();
    const { deps } = await fixture.device();
    const manager = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch(request) {
        if (new URL(request.url).pathname !== "/v1/workbenches") return Response.json({ ok: true });
        if (membership === "unknown") return new Response("Unavailable", { status: 503 });
        return Response.json(membership === "cloud" ? [{ workbenchId: fixture.projectId }] : []);
      },
    });
    const file = join(fixture.root, "account.json");
    const { environmentId: deviceId } = await deps.environmentService.get();
    await Bun.write(
      file,
      JSON.stringify({
        login: {
          managerOrigin: manager.url.origin,
          relayOrigin: manager.url.origin,
          accountId: "account",
          deviceId,
          token: "fixture-credential",
        },
      }),
    );
    const account = createNativeAccount({ file, environment: deps.environmentService, projects: deps.projectService });
    deps.accountService = account as never;
    const clock = createTestCronDriver();
    const calls: unknown[] = [];
    (globalThis as Record<string, unknown>).__deviceAutomationRun = async () => {
      calls.push(true);
    };
    const scheduler = createExtensionScheduler({
      deps,
      listProjectIds: async () => [fixture.projectId],
      cron: clock.factory,
      now: () => new Date("2026-10-22T09:00:00Z"),
      watermarkPath: join(fixture.root, "review.json"),
    });
    try {
      await scheduler.refresh();
      expect(await account.projectSyncStatus(fixture.projectId)).toEqual({ state: "offline", offlineReady: false });
      expect(clock.size()).toBe(0);
      await account.refresh();
      const expected = ({ local: "local", cloud: "first-download-incomplete", unknown: "offline" } as const)[
        membership
      ];
      expect((await account.projectSyncStatus(fixture.projectId)).state).toBe(expected);
      if (membership !== "local") {
        await scheduler.refresh();
        expect(clock.size()).toBe(0);
        // Logging out restores local ownership without a database or extension event.
        await account.logout();
        expect((await account.projectSyncStatus(fixture.projectId)).state).toBe("local");
      }
      for (let i = 0; clock.size() === 0 && i < 100; i++) await Bun.sleep(10);
      expect(clock.size()).toBe(1);
      await clock.fireAll();
      expect(calls).toHaveLength(1);
    } finally {
      await scheduler.dispose();
      account.close();
      await manager.stop(true);
      await fixture.close();
    }
  });
}
