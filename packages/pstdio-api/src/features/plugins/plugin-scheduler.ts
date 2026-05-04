import type { PluginRuntime, PluginRuntimeStore } from "pstdio-plugins/hooks";
import {
  type CronFactory,
  createFileWatermarkStore,
  createScheduler,
  type Job,
  type Scheduler,
} from "pstdio-scheduler";
import { apiLogger } from "../../lib/logger";

type Input = {
  runtimeStore: PluginRuntimeStore;
  listProjectIds: () => Promise<string[]>;
  watermarkPath: string;
  now?: () => Date;
  cron?: CronFactory;
};

export const createPluginScheduler = (input: Input): Scheduler & { dispose: () => Promise<void> } => {
  const scheduler = createScheduler({
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

  const unsubscribe = input.runtimeStore.subscribe(() => {
    void scheduler.refresh();
  });

  return {
    refresh: scheduler.refresh,
    async dispose() {
      unsubscribe();
      await scheduler.dispose();
    },
  };
};
