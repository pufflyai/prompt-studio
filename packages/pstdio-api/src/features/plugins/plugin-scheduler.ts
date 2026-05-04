import type { PluginRuntime } from "pstdio-plugins/hooks";
import {
  type CronFactory,
  createFileWatermarkStore,
  createScheduler,
  type Job,
  type Scheduler,
} from "pstdio-scheduler";
import { apiLogger } from "../../lib/logger";

type SchedulerRuntimeStore = {
  getForProject(projectId: string): Promise<PluginRuntime>;
};

type Input = {
  runtimeStore: SchedulerRuntimeStore;
  listProjectIds: () => Promise<string[]>;
  watermarkPath: string;
  refreshIntervalMs?: number;
  now?: () => Date;
  cron?: CronFactory;
};

export const createPluginScheduler = (input: Input): Scheduler => {
  return createScheduler({
    refreshIntervalMs: input.refreshIntervalMs,
    now: input.now,
    cron: input.cron,
    logger: apiLogger,
    watermarks: createFileWatermarkStore(input.watermarkPath),

    listJobs: async () => {
      const jobs: Job[] = [];

      for (const projectId of await input.listProjectIds()) {
        let runtime: PluginRuntime;
        try {
          runtime = await input.runtimeStore.getForProject(projectId);
        } catch (err) {
          apiLogger.error(
            { err, event: "plugin.schedule.project.load.error", projectId },
            "Failed to load project plugin runtime for scheduler",
          );
          continue;
        }

        for (const schedule of runtime.schedules.list()) {
          jobs.push({
            key: `${projectId}/${schedule.key}`,
            cron: schedule.cron,
            timeoutMs: schedule.timeoutMs,
            meta: {
              projectId,
              scheduleKey: schedule.key,
              scheduleName: schedule.scheduleName,
              pluginIdentity: schedule.pluginIdentity,
            },
          });
        }
      }

      return jobs;
    },

    runJob: async (job, ctx) => {
      const meta = job.meta as { projectId: string; scheduleKey: string };
      const runtime = await input.runtimeStore.getForProject(meta.projectId);
      const schedule = runtime.schedules.get(meta.scheduleKey);
      if (!schedule) return;

      await runtime.schedules.trigger({
        schedule,
        projectId: meta.projectId,
        runId: ctx.runId,
        scheduledFor: ctx.scheduledFor.toISOString(),
      });
    },
  });
};
