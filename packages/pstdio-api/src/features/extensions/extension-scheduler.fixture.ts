import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { createProjectExtensionRuntimeCatalog } from "./project-extension-runtime-catalog";

export const createScheduleStorage = () => ({
  values: new Map<string, unknown>(),
  listeners: new Set<(owner: { workbenchId: string; extensionId: string }) => void>(),
});

export const tempRoots: string[] = [];

export const createTempRoot = () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-extension-scheduler-test-"));
  tempRoots.push(root);
  return root;
};

export const waitFor = async (condition: () => Promise<boolean> | boolean, timeoutMs = 2_000) => {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    if (await condition()) return;
    await Bun.sleep(25);
  }

  throw new Error(`Condition not met within ${timeoutMs}ms`);
};

export const writeScheduledExtension = (
  options: { scheduleDisabled?: boolean; workspaceId?: string; conditional?: boolean } = {},
) => {
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
      const state = globalThis.__extensionScheduleState;

      export default {
        commands: [
          {
            id: "heartbeat",
            ref: { kind: "command", id: "heartbeat" },
            title: "Heartbeat",
            async run(ctx, commandParams) {
              state.calls.push({
                source: ctx.source,
                metadata: ctx.invocation.metadata,
                params: commandParams,
              });
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
            ${options.conditional ? `enabledWhen: async ({ storage }) => Boolean((await storage.get("mode"))?.enabled),` : ""}
            params: { from: "schedule" },${options.scheduleDisabled ? "\n            disabled: true," : ""}
          },
        ],
      };
    `,
  );

  return root;
};

type AutomationPreferenceRow = { extension_instance_id: string; automation_id: string; enabled: boolean };

export const createDeps = (
  sourcePath: string,
  automationPreferences: AutomationPreferenceRow[] = [],
  storage = createScheduleStorage(),
) => {
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
  const workspaceService = { get: async () => null, getDefault: async () => null };
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
      workspaceService: workspaceService as never,
    }),
    extensionService,
    projectService,
    extensionStorageService: {
      watch: (listener: (owner: { workbenchId: string; extensionId: string }) => void) => {
        storage.listeners.add(listener);
        return () => {
          storage.listeners.delete(listener);
        };
      },
      getKv: async (scope: { scope_id: string }, key: string) => {
        const value = storage.values.get(`${scope.scope_id}/${key}`);
        return value === undefined ? null : { value_json: value };
      },
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
