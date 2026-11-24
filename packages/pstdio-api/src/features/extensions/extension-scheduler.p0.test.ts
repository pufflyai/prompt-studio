import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { createTestCronDriver } from "pstdio-scheduler/testing";
import { createTestDocumentStorage } from "../../test-utils/create-test-document-storage";
import { createTestExtensionProcessOwners } from "../../test-utils/create-test-extension-process-owners";
import { createExtensionProbe } from "../../test-utils/extension-probe";
import { createExtensionScheduler } from "./extension-scheduler";
import { createProjectExtensionRuntimeCatalog } from "./project-extension-runtime-catalog";

const tempRoots: string[] = [];
const processOwners: ReturnType<typeof createTestExtensionProcessOwners>[] = [];
// The scheduled command runs in a worker; it reports each call to the test's current state.
const probe = createExtensionProbe();
type ScheduleState = { calls: unknown[]; blocker?: Promise<void> };
const observe = (state: ScheduleState) =>
  probe.answer(async (call) => {
    state.calls.push(call);
    await state.blocker;
  });
afterAll(() => probe.stop());
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

const writeScheduledExtension = (options: { scheduleDisabled?: boolean; workspaceId?: string } = {}) => {
  const root = createTempRoot();
  mkdirSync(root, { recursive: true });
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({
      name: "lab",
      version: "1.0.0",
      publisher: "pstdio",
      main: "./extension.ts",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
      type: "module",
    }),
  );
  writeFileSync(
    join(root, "extension.ts"),
    `
      export default {
        commands: [
          {
            id: "heartbeat",
            ref: { kind: "command", id: "heartbeat" },
            title: "Heartbeat",
            async run(ctx, commandParams) {
              ${probe.call("{ source: ctx.source, metadata: ctx.invocation.metadata, params: commandParams }")};
            },
          },
        ],
        schedules: [
          {
            id: "heartbeat",
            ref: { kind: "schedule", id: "heartbeat" },
            title: "Heartbeat",
            schedule: "* * * * *",
            command: { kind: "command", id: "heartbeat" },
            workspaceId: ${JSON.stringify(options.workspaceId)},
            params: { from: "schedule" },${options.scheduleDisabled ? "\n            disabled: true," : ""}
          },
        ],
      };
    `,
  );

  return root;
};

type AutomationPreferenceRow = { extension_instance_id: string; automation_id: string; enabled: boolean };

const createDeps = (sourcePath: string, automationPreferences: AutomationPreferenceRow[] = []) => {
  const extensionService = {
    listProjectExtensionInstances: async () => extensionService.listEnabledSourcesForProject(),
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
  const workspaceService = { get: async () => null, getDefault: async () => null };
  const projectService = {
    get: async () => ({ id: "project-1", name: "Project", shorthand: "PS" }),
  };
  const extensionProcessOwners = createTestExtensionProcessOwners(extensionService.listEnabledSourcesForProject);
  processOwners.push(extensionProcessOwners);
  return {
    extensionProcessOwners,
    accountService: { watch: () => () => {}, projectSyncStatus: async () => ({ state: "local" }) },
    environmentService: { get: async () => ({ environmentId: "local" }) },
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
      workspaceService: workspaceService as never,
    }),
    extensionService,
    projectService,
    extensionStorageService: {
      ...createTestDocumentStorage(),
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
    workspaceService,
    sessionService: {},
  } as never;
};

afterEach(async () => {
  await Promise.all(schedulers.splice(0).map((scheduler) => scheduler.dispose()));
  await Promise.all(processOwners.splice(0).map((owner) => owner.dispose()));

  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("createExtensionScheduler", () => {
  test("runs extension schedule commands with schedule metadata", async () => {
    const sourcePath = writeScheduledExtension();
    const run = Promise.withResolvers<void>();
    const state = {
      calls: [] as Array<{ source?: string; metadata?: Record<string, unknown>; params?: unknown }>,
      blocker: run.promise,
    };
    observe(state);

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
    try {
      expect(scheduler.activity()).toEqual([
        {
          id: expect.any(String),
          label: "Heartbeat",
          description: "Project",
        },
      ]);
    } finally {
      run.resolve();
    }
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
    observe(state);

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
    observe(state);

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
  observe(state);
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

test("a cloud schedule without a device assignment stays idle", async () => {
  const sourcePath = writeScheduledExtension();
  const deps = {
    ...(createDeps(sourcePath) as unknown as Record<string, unknown>),
    accountService: { watch: () => () => {}, projectSyncStatus: async () => ({ state: "synced", offlineReady: true }) },
  };
  const cron = createTestCronDriver();
  const scheduler = createExtensionScheduler({
    deps: deps as never,
    listProjectIds: async () => ["project-1"],
    watermarkPath: join(createTempRoot(), "watermarks.json"),
    now: () => new Date("2026-05-18T07:56:15.000Z"),
    cron: cron.factory,
  });
  schedulers.push(scheduler);
  await scheduler.refresh();
  expect(cron.size()).toBe(0);
});

test("publishing webview assets does not rescan schedules across projects", async () => {
  const deps: Parameters<typeof createExtensionScheduler>[0]["deps"] = createDeps(writeScheduledExtension());
  let scans = 0;
  const scheduler = createExtensionScheduler({
    deps,
    listProjectIds: async () => {
      scans++;
      return [];
    },
    watermarkPath: join(createTempRoot(), "watermarks.json"),
  });
  try {
    await scheduler.refresh();
    const before = scans;
    deps.extensionRuntimeCatalog.invalidate({ reason: "webviews_built" });
    expect(scans).toBe(before);
    deps.extensionRuntimeCatalog.invalidate({ reason: "source_changed" });
    expect(scans).toBeGreaterThan(before);
  } finally {
    await scheduler.dispose();
  }
});
