import type { ExtensionLoggerApi, JsonObject, Localizable } from "pstdio-api-contracts/extension-kernel";
import { createCommandRunner } from "pstdio-extensions";
import {
  type CronFactory,
  createFileWatermarkStore,
  createScheduler,
  type Job,
  type RunContext,
} from "pstdio-scheduler";
import { apiLogger } from "../../lib/logger";
import type { ExtensionsRouteDeps } from "./deps";
import { instanceIdsByExtensionId, isAutomationEnabled, loadAutomationPreferences } from "./extension-automations";
import { createCommandEnvironment, loadProjectExtensionRuntime } from "./extension-command-runtime";

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

const extensionLogger: ExtensionLoggerApi = {
  info(message, metadata) {
    apiLogger.info({ event: "extension.log", metadata: metadata ?? {} }, message);
  },
  warn(message, metadata) {
    apiLogger.warn({ event: "extension.log", metadata: metadata ?? {} }, message);
  },
  error(message, metadata) {
    apiLogger.error({ event: "extension.log", metadata: metadata ?? {} }, message);
  },
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

const resolveScheduleRepo = async (deps: ExtensionsRouteDeps, projectId: string, repoId: string | undefined) => {
  if (!repoId) return undefined;

  const repo = await deps.repoService.get(repoId);
  if (!repo) throw new Error(`Repo not found for extension schedule: ${repoId}`);

  return { projectId, repoId: repo.id, path: repo.path };
};

const outcomeError = (input: { commandId: string; reason?: string; status?: string }) =>
  new Error(
    `Extension schedule command "${input.commandId}" failed: ${input.reason ?? input.status ?? "unknown error"}`,
  );

export const createExtensionScheduler = (input: Input) => {
  const scheduler = createScheduler({
    now: input.now,
    cron: input.cron,
    logger: apiLogger,
    watermarks: createFileWatermarkStore(input.watermarkPath),

    listJobs: async () => {
      const jobs: Job[] = [];

      for (const projectId of await input.listProjectIds()) {
        let runtime: Awaited<ReturnType<typeof loadProjectExtensionRuntime>>["runtime"];
        let instanceIds: Map<string, string>;
        try {
          const loaded = await loadProjectExtensionRuntime(input.deps, projectId);
          runtime = loaded.runtime;
          instanceIds = instanceIdsByExtensionId(loaded.enabledSources);
        } catch (err) {
          apiLogger.error(
            { err, event: "extension.schedule.project.load.error", projectId },
            "Failed to load project extension runtime for scheduler",
          );
          continue;
        }

        const preferences = await loadAutomationPreferences(input.deps, projectId);

        for (const schedule of runtime.schedules) {
          if (!isAutomationEnabled(schedule, instanceIds.get(schedule.extensionId), preferences)) continue;

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

      return jobs;
    },

    runJob: async (job, ctx) => {
      const meta = job.meta as ScheduleJobMeta;
      const { enabledSources, project, runtime } = await loadProjectExtensionRuntime(input.deps, meta.projectId);
      const schedule = runtime.schedules.find((candidate) => candidate.id === meta.scheduleId);
      if (!schedule) return;

      const preferences = await loadAutomationPreferences(input.deps, meta.projectId);
      if (
        !isAutomationEnabled(schedule, instanceIdsByExtensionId(enabledSources).get(schedule.extensionId), preferences)
      )
        return;

      const runner = createCommandRunner(runtime, {
        logger: input.extensionLogger ?? extensionLogger,
        buildEnvironment: (ids) =>
          createCommandEnvironment(input.deps, enabledSources, {
            extensionId: ids.extensionId,
            name: ids.name,
            project,
            projectId: ids.projectId,
            repo: ids.repo,
            workspaceDir: ids.workspaceDir,
            settings: runtime.settings,
          }),
      });

      const outcome = await runner.execute({
        commandId: schedule.commandId,
        projectId: meta.projectId,
        params: (schedule.params ?? {}) as JsonObject,
        repo: await resolveScheduleRepo(input.deps, meta.projectId, schedule.repoId),
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

  return {
    refresh: scheduler.refresh,
    async dispose() {
      unsubscribe?.();
      await scheduler.dispose();
    },
  };
};
