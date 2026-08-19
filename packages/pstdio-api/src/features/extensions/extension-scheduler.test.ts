import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestCronDriver } from "pstdio-scheduler/testing";
import { createExtensionScheduler } from "./extension-scheduler";
import { createProjectExtensionRuntimeCatalog } from "./project-extension-runtime-catalog";

const tempRoots: string[] = [];
const schedulers: Array<{ dispose: () => Promise<void> }> = [];

const createTempRoot = () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-extension-scheduler-test-"));
  tempRoots.push(root);
  return root;
};

const waitFor = async (condition: () => Promise<boolean> | boolean, timeoutMs = 2_000) => {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    if (await condition()) return;
    await Bun.sleep(25);
  }

  throw new Error(`Condition not met within ${timeoutMs}ms`);
};

const writeScheduledExtension = (options: { scheduleDisabled?: boolean } = {}) => {
  const root = createTempRoot();
  mkdirSync(root, { recursive: true });
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({
      name: "lab",
      version: "1.0.0",
      publisher: "pstdio",
      main: "./extension.ts",
      engines: { pstdio: "^1.0.0" },
      type: "module",
    }),
  );
  writeFileSync(
    join(root, "extension.ts"),
    `
      const state = globalThis.__extensionScheduleState;

      export default {
        commands: {
          heartbeat: {
            title: "Heartbeat",
            async run(ctx) {
              state.calls.push({
                source: ctx.source,
                metadata: ctx.invocation.metadata,
                params: ctx.params,
              });
            },
          },
        },
        schedules: {
          heartbeat: {
            title: "Heartbeat",
            cron: "* * * * *",
            commandId: "lab.heartbeat",
            params: { from: "schedule" },${options.scheduleDisabled ? "\n            disabled: true," : ""}
          },
        },
      };
    `,
  );

  return root;
};

type AutomationPreferenceRow = { extension_instance_id: string; automation_id: string; enabled: boolean };

const createDeps = (sourcePath: string, automationPreferences: AutomationPreferenceRow[] = []) => {
  const extensionService = {
    listEnabledSourcesForProject: async () => [
      {
        instance: { id: "instance-1" },
        installedSource: {
          id: "source-1",
          extension_id: "pstdio.lab",
          source_kind: "local_path" as const,
          source_path: sourcePath,
          status: "loaded",
        },
      },
    ],
  };
  const repoService = { listByProject: async () => [] };
  const projectService = {
    get: async () => ({ id: "project-1", name: "Project", shorthand: "PS" }),
  };
  return {
    extensionAutomationPreferencesService: {
      list: async () => automationPreferences,
      get: async (_projectId: string, instanceId: string, automationId: string) =>
        automationPreferences.find(
          (row) => row.extension_instance_id === instanceId && row.automation_id === automationId,
        ) ?? null,
    },
    extensionRuntimeCatalog: createProjectExtensionRuntimeCatalog({
      extensionService: extensionService as never,
      projectService: projectService as never,
      repoService: repoService as never,
    }),
    extensionService,
    projectService,
    extensionStorageService: {
      getKv: async () => null,
      setKv: async () => {},
      deleteKv: async () => {},
      getCollectionItem: async () => null,
      listCollection: async () => [],
      setCollectionItem: async () => {},
      deleteCollectionItem: async () => {},
    },
    activityEventsService: {},
    fileService: {},
    repoService,
    sessionService: {},
    workspaceService: {},
  } as never;
};

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
        scheduleId: "lab.heartbeat",
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
        { extension_instance_id: "instance-1", automation_id: "lab.heartbeat", enabled: false },
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
        { extension_instance_id: "instance-1", automation_id: "lab.heartbeat", enabled: true },
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
