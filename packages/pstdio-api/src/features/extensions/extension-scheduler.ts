import type { ExtensionLoggerApi, JsonObject, Localizable } from "pstdio-api-contracts/extension-kernel";
import { createCommandRunner, type RuntimeScheduleRecord } from "pstdio-extensions";
import {
  type CronFactory,
  createFileWatermarkStore,
  createScheduler,
  type Job,
  type RunContext,
} from "pstdio-scheduler";
import { apiLogger } from "../../lib/logger";
import { createCommandEnvironment } from "./command-environment";
import { createStorageApi } from "./command-environment/storage";
import type { ExtensionsRouteDeps } from "./deps";
import { instanceIdsByExtensionId, isAutomationEnabled, loadAutomationPreferences } from "./extension-automations";
import { createExtensionLogger } from "./extension-logger";
import type { ProjectExtensionRuntimeSnapshot } from "./project-extension-runtime-snapshot";

const EXTENSION_SCHEDULE_TIMEOUT_MS = 15_000;

type Input = {
  deps: ExtensionsRouteDeps;
  listProjectIds: () => Promise<string[]>;
  watermarkPath: string;
  now?: () => Date;
  cron?: CronFactory;
  extensionLogger?: ExtensionLoggerApi;
};

type ScheduleJobMeta = {
  projectId: string;
  scheduleId: string;
  commandId: string;
  extensionId: string;
  extensionName: string;
};

const isExtensionChangeEvent = (event: { table: string }) =>
  event.table === "extension_instances" ||
  event.table === "installed_extension_sources" ||
  event.table === "extension_automation_preferences" ||
  event.table === "projects";

const scheduleTitle = (title: Localizable<string>) =>
  typeof title === "string" ? title : (title.default ?? title.$l10n);

const scheduleMetadata = (schedule: { id: string; title: Localizable<string> }, ctx: RunContext) => ({
  reason: ctx.reason,
  runId: ctx.runId,
  scheduleId: schedule.id,
  scheduleTitle: scheduleTitle(schedule.title),
  scheduledFor: ctx.scheduledFor.toISOString(),
});

const outcomeError = (input: { commandId: string; reason?: string; status?: string }) =>
  new Error(
    `Extension schedule command "${input.commandId}" failed: ${input.reason ?? input.status ?? "unknown error"}`,
  );

const resolveScheduleWorkspace = async (
  deps: ExtensionsRouteDeps,
  schedule: RuntimeScheduleRecord,
  projectId: string,
) => {
  const workspace = schedule.workspaceId
    ? await deps.workspaceService.get(schedule.workspaceId)
    : await deps.workspaceService.getDefault(projectId);
  if (schedule.workspaceId && !workspace) throw new Error("Scheduled workspace no longer exists.");
  if (workspace && workspace.project_id !== projectId) throw new Error("Workspace does not belong to this project.");
  return workspace;
};

export const createExtensionScheduler = (input: Input) => {
  let conditionalOwners = new Set<string>();
  const eligible = async (schedule: RuntimeScheduleRecord, projectId: string, instanceId: string | undefined) => {
    if (!schedule.enabledWhen) return true;
    if (!instanceId) return false;
    try {
      return await schedule.enabledWhen({
        storage: createStorageApi(input.deps, {
          projectId,
          extensionId: schedule.extensionId,
          extensionInstanceId: instanceId,
        }),
      });
    } catch (err) {
      apiLogger.error(
        { err, event: "extension.schedule.eligibility.error", projectId, scheduleId: schedule.id },
        "Failed to evaluate schedule eligibility",
      );
      return false;
    }
  };

  const scheduler = createScheduler({
    now: input.now,
    cron: input.cron,
    logger: apiLogger,
    watermarks: createFileWatermarkStore(input.watermarkPath),

    listJobs: async () => {
      const jobs: Job[] = [];
      const owners = new Set<string>();

      for (const projectId of await input.listProjectIds()) {
        let snapshot: ProjectExtensionRuntimeSnapshot;
        let instanceIds: Map<string, string>;
        try {
          snapshot = await input.deps.extensionRuntimeCatalog.get(projectId);
          instanceIds = instanceIdsByExtensionId(snapshot.enabledSources);
        } catch (err) {
          apiLogger.error(
            { err, event: "extension.schedule.project.load.error", projectId },
            "Failed to load project extension runtime for scheduler",
          );
          continue;
        }

        const preferences = await loadAutomationPreferences(input.deps, projectId);

        for (const schedule of snapshot.runtime.schedules) {
          if (schedule.enabledWhen) {
            const owner = JSON.stringify([projectId, schedule.extensionId]);
            owners.add(owner);
            conditionalOwners.add(owner);
          }
          const instanceId = instanceIds.get(schedule.extensionId);
          if (!isAutomationEnabled(schedule, instanceId, preferences)) continue;
          if (!(await eligible(schedule, projectId, instanceId))) continue;

          jobs.push({
            key: `${projectId}/${schedule.id}`,
            cron: schedule.cron,
            timeoutMs: EXTENSION_SCHEDULE_TIMEOUT_MS,
            meta: {
              projectId,
              scheduleId: schedule.id,
              commandId: schedule.commandId,
              extensionId: schedule.extensionId,
              extensionName: schedule.name,
            } satisfies ScheduleJobMeta,
          });
        }
      }

      conditionalOwners = owners;
      return jobs;
    },

    runJob: async (job, ctx) => {
      const meta = job.meta as ScheduleJobMeta;
      // One snapshot capture serves the whole run; an invalidation mid-run never swaps it.
      const snapshot = await input.deps.extensionRuntimeCatalog.get(meta.projectId);
      const schedule = snapshot.runtime.schedules.find((candidate) => candidate.id === meta.scheduleId);
      if (!schedule) return;

      const preferences = await loadAutomationPreferences(input.deps, meta.projectId);
      const instanceId = instanceIdsByExtensionId(snapshot.enabledSources).get(schedule.extensionId);
      if (!isAutomationEnabled(schedule, instanceId, preferences)) return;
      if (!(await eligible(schedule, meta.projectId, instanceId))) return;

      const runner = createCommandRunner(snapshot.runtime, {
        logger: input.extensionLogger,
        createLogger: input.extensionLogger ? () => input.extensionLogger! : createExtensionLogger,
        buildEnvironment: (ids) =>
          createCommandEnvironment(input.deps, snapshot.enabledSources, {
            artifactMounts: snapshot.runtime.artifactMounts,
            extensionId: ids.extensionId,
            name: ids.name,
            project: snapshot.project,
            projectId: ids.projectId,
            workspaceDir: ids.workspaceDir,
            workspaceId: ids.workspaceId,
            settings: snapshot.runtime.settings,
          }),
      });

      const workspace = await resolveScheduleWorkspace(input.deps, schedule, meta.projectId);
      const outcome = await runner.execute({
        commandId: schedule.commandId,
        projectId: meta.projectId,
        params: (schedule.params ?? {}) as JsonObject,
        workspaceId: workspace?.id,
        workspaceDir: workspace?.execution_kind === "local" ? (workspace.root_path ?? undefined) : undefined,
        source: "schedule",
        metadata: scheduleMetadata(schedule, ctx),
      });

      if (!outcome.ok) {
        throw outcomeError({ commandId: schedule.commandId, reason: outcome.reason, status: outcome.status });
      }
    },
  });

  const unsubscribe = input.deps.eventBus?.subscribe((event) => {
    if (isExtensionChangeEvent(event)) void scheduler.refresh();
  });
  const stopStorage = input.deps.extensionStorageService.watch((owner) => {
    if (conditionalOwners.has(JSON.stringify([owner.workbenchId, owner.extensionId]))) void scheduler.refresh();
  });

  return {
    activity: scheduler.activity,
    refresh: scheduler.refresh,
    async dispose() {
      unsubscribe?.();
      stopStorage();
      await scheduler.dispose();
    },
  };
};
