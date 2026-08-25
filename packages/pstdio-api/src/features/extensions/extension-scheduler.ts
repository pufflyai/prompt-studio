import type { ExtensionLoggerApi, JsonObject, Localizable } from "pstdio-api-contracts/extension-kernel";
import { type CommandRunnerEnvironment, createCommandRunner } from "pstdio-extensions";
import {
  type CronFactory,
  createFileWatermarkStore,
  createScheduler,
  type Job,
  type RunContext,
} from "pstdio-scheduler";
import { apiLogger } from "../../lib/logger";
import { createCommandEnvironment } from "./command-environment";
import type { ExtensionsRouteDeps } from "./deps";
import { instanceIdsByExtensionId, isAutomationEnabled, loadAutomationPreferences } from "./extension-automations";
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

type ScheduledActivity = Parameters<CommandRunnerEnvironment["activity"]["record"]>[0];

const activitySummary = (activities: ScheduledActivity[]) =>
  activities.length > 0 ? activities.map((activity) => activity.message).join("\n") : "No activity was recorded.";

const scheduleNotificationDedupeKey = (projectId: string, scheduleId: string) =>
  `extension-schedule:${projectId}:${scheduleId}`;

const notifyScheduledRun = async (
  deps: ExtensionsRouteDeps,
  input: {
    activities: ScheduledActivity[];
    error?: Error;
    extensionName: string;
    projectId: string;
    scheduleId: string;
    scheduleTitle: string;
    sourceExtensionId?: string;
  },
) => {
  const failed = Boolean(input.error);
  const summary = activitySummary(input.activities);
  const errorDetail = input.error ? `\n\nError: ${input.error.message}` : "";
  await deps.notificationService.create({
    projectId: input.projectId,
    title: `Scheduled run ${failed ? "failed" : "active"}: ${input.scheduleTitle}`,
    body: `${input.extensionName}\n\n${summary}${errorDetail}`,
    kind: failed ? "failed" : "info",
    priority: failed ? "high" : "normal",
    source: "schedule",
    origin: "extension",
    sourceExtensionId: input.sourceExtensionId,
    actorType: "system",
    dedupeKey: scheduleNotificationDedupeKey(input.projectId, input.scheduleId),
    metadata: {
      scheduleId: input.scheduleId,
      scheduleTitle: input.scheduleTitle,
      extensionName: input.extensionName,
      activityCount: input.activities.length,
      activitySummary: summary,
    },
  });
};

export const createExtensionScheduler = (input: Input) => {
  const scheduler = createScheduler({
    now: input.now,
    cron: input.cron,
    logger: apiLogger,
    watermarks: createFileWatermarkStore(input.watermarkPath),

    listJobs: async () => {
      const jobs: Job[] = [];

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
      // One snapshot capture serves the whole run; an invalidation mid-run never swaps it.
      const snapshot = await input.deps.extensionRuntimeCatalog.get(meta.projectId);
      const schedule = snapshot.runtime.schedules.find((candidate) => candidate.id === meta.scheduleId);
      if (!schedule) return;

      const preferences = await loadAutomationPreferences(input.deps, meta.projectId);
      const instanceId = instanceIdsByExtensionId(snapshot.enabledSources).get(schedule.extensionId);
      if (!isAutomationEnabled(schedule, instanceId, preferences)) return;

      const activities: ScheduledActivity[] = [];
      const runner = createCommandRunner(snapshot.runtime, {
        logger: input.extensionLogger ?? extensionLogger,
        buildEnvironment: (ids) => {
          const environment = createCommandEnvironment(input.deps, snapshot.enabledSources, {
            extensionId: ids.extensionId,
            name: ids.name,
            project: snapshot.project,
            projectId: ids.projectId,
            repo: ids.repo,
            workspaceDir: ids.workspaceDir,
            settings: snapshot.runtime.settings,
          });
          return {
            ...environment,
            activity: {
              record: async (activity) => {
                const recorded = await environment.activity.record(activity);
                activities.push(activity);
                return recorded;
              },
            },
          };
        },
      });

      const notificationInput = {
        activities,
        extensionName: meta.extensionName,
        projectId: meta.projectId,
        scheduleId: schedule.id,
        scheduleTitle: scheduleTitle(schedule.title),
        sourceExtensionId: snapshot.enabledSources.find(
          (source) => source.installedSource.extension_id === schedule.extensionId,
        )?.installedSource.id,
      };

      try {
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
      } catch (error) {
        const failure = error instanceof Error ? error : new Error(String(error));
        await notifyScheduledRun(input.deps, { ...notificationInput, error: failure });
        throw failure;
      }

      if (activities.length > 0) await notifyScheduledRun(input.deps, notificationInput);
    },
  });

  const unsubscribe = input.deps.eventBus?.subscribe((event) => {
    if (isExtensionChangeEvent(event)) void scheduler.refresh();
  });

  return {
    activity: scheduler.activity,
    refresh: scheduler.refresh,
    async dispose() {
      unsubscribe?.();
      await scheduler.dispose();
    },
  };
};
