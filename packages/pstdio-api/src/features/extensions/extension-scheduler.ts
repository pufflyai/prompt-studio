import type { ExtensionLoggerApi, JsonObject } from "@pstdio/sdk/extensions";
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
  event.table === "extension_instances" || event.table === "installed_extension_sources" || event.table === "projects";

const scheduleMetadata = (schedule: { id: string; title: string }, ctx: RunContext) => ({
  reason: ctx.reason,
  runId: ctx.runId,
  scheduleId: schedule.id,
  scheduleTitle: schedule.title,
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
        try {
          runtime = (await loadProjectExtensionRuntime(input.deps, projectId)).runtime;
        } catch (err) {
          apiLogger.error(
            { err, event: "extension.schedule.project.load.error", projectId },
            "Failed to load project extension runtime for scheduler",
          );
          continue;
        }

        for (const schedule of runtime.schedules) {
          if (schedule.disabled) continue;

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
      const { enabledSources, runtime } = await loadProjectExtensionRuntime(input.deps, meta.projectId);
      const schedule = runtime.schedules.find((candidate) => candidate.id === meta.scheduleId);
      if (!schedule || schedule.disabled) return;

      const runner = createCommandRunner(runtime, {
        logger: input.extensionLogger ?? extensionLogger,
        buildEnvironment: (ids) =>
          createCommandEnvironment(input.deps, enabledSources, {
            extensionId: ids.extensionId,
            name: ids.name,
            projectId: ids.projectId,
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
