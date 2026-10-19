import type { ExtensionLoggerApi } from "pstdio-api-contracts/extension-kernel";
import { type CronFactory, createFileWatermarkStore, createScheduler, type Job } from "pstdio-scheduler";
import { automationRunId, automationsId, publishedExtensionsId } from "pstdio-sync-contracts";
import { apiLogger } from "../../lib/logger";
import { createScheduleAdmission } from "./extension-schedule-admission";
import { executeScheduledCommand } from "./extension-schedule-execution";
import type { AutomationDeps } from "./synchronized-automations/catalog";
import { createAutomationRunJournal } from "./synchronized-automations/runs";
import { acknowledgeAutomations } from "./synchronized-automations/state";

const EXTENSION_SCHEDULE_TIMEOUT_MS = 15_000;
interface Input {
  deps: AutomationDeps;
  listProjectIds: () => Promise<string[]>;
  watermarkPath: string;
  now?: () => Date;
  cron?: CronFactory;
  extensionLogger?: ExtensionLoggerApi;
}
interface ScheduleJobMeta {
  projectId: string;
  scheduleId: string;
  targeted: boolean;
}

export const createExtensionScheduler = (input: Input) => {
  const initialized = new Set<string>();
  let admissionGeneration = 0;
  const journalFor = (projectId: string) => createAutomationRunJournal(input.deps, projectId);
  const projectJobs = async (projectId: string, seen: Set<string>) => {
    const snapshot = await input.deps.extensionRuntimeCatalog.get(projectId);
    const { admit, state } = await createScheduleAdmission(input.deps, projectId, snapshot);
    await acknowledgeAutomations(input.deps, state);
    const jobs: Job[] = [];
    for (const schedule of snapshot.runtime.schedules) {
      const admission = await admit(schedule);
      if (!admission) continue;
      const key = `${projectId}/${schedule.id}`;
      if (admission.targeted) {
        seen.add(key);
        if (!initialized.has(key)) {
          await journalFor(projectId).skipThrough(admission.definition, schedule.cron, input.now?.() ?? new Date());
          initialized.add(key);
        }
      }
      jobs.push({
        key,
        runId: (scheduledFor) => automationRunId(projectId, schedule.id, scheduledFor.toISOString()),
        cron: schedule.cron,
        catchup: admission.targeted ? "skip" : undefined,
        timeoutMs: EXTENSION_SCHEDULE_TIMEOUT_MS,
        meta: { projectId, scheduleId: schedule.id, targeted: admission.targeted } satisfies ScheduleJobMeta,
      });
    }
    return jobs;
  };
  const scheduler = createScheduler({
    now: input.now,
    cron: input.cron,
    logger: apiLogger,
    watermarks: createFileWatermarkStore(input.watermarkPath),
    listJobs: async () => {
      const jobs: Job[] = [];
      const seen = new Set<string>();
      for (const projectId of await input.listProjectIds()) {
        try {
          jobs.push(...(await projectJobs(projectId, seen)));
        } catch (err) {
          apiLogger.error(
            { err, event: "extension.schedule.project.load.error", projectId },
            "Failed to load project extension runtime for scheduler",
          );
        }
      }
      for (const key of initialized) if (!seen.has(key)) initialized.delete(key);
      return jobs;
    },
    runJob: async (job, ctx) => {
      const meta = job.meta as unknown as ScheduleJobMeta;
      // One snapshot serves the run; invalidation never swaps command code mid-run.
      const snapshot = await input.deps.extensionRuntimeCatalog.get(meta.projectId);
      const schedule = snapshot.runtime.schedules.find((candidate) => candidate.id === meta.scheduleId);
      if (!schedule) return;
      const { admit } = await createScheduleAdmission(input.deps, meta.projectId, snapshot);
      const admission = await admit(schedule);
      if (!admission || (meta.targeted && !admission.targeted)) return;
      const journal = journalFor(meta.projectId);
      const runId = admission.targeted
        ? await journal.claim(admission.definition, schedule.cron, ctx.scheduledFor)
        : null;
      if (admission.targeted && !runId) return;
      try {
        const dispatched = await executeScheduledCommand({
          ...input,
          snapshot,
          schedule,
          workspaceId: admission.workspaceId,
          ctx,
          beforeDispatch: async () => {
            const generation = admissionGeneration;
            const { admit: recheck } = await createScheduleAdmission(input.deps, meta.projectId, snapshot);
            const allowed = await recheck(schedule);
            return () =>
              Boolean(
                allowed && allowed.targeted === admission.targeted && allowed.workspaceId === admission.workspaceId,
              ) && generation === admissionGeneration;
          },
        });
        await journal.finish(runId, dispatched ? "completed" : "skipped");
      } catch (error) {
        await journal.finish(runId, "failed");
        throw error;
      }
    },
  });
  const refresh = () => {
    admissionGeneration++;
    return scheduler.refresh();
  };
  const unsubscribe = input.deps.eventBus?.subscribe((event) => {
    if (
      [
        "extension_instances",
        "installed_extension_sources",
        "extension_automation_preferences",
        "projects",
        "workspaces",
        "automation_definitions",
      ].includes(event.table)
    )
      void refresh();
  });
  const stopStorage = input.deps.extensionStorageService.watch?.((owner) => {
    if ([automationsId, publishedExtensionsId].includes(owner.extensionId)) void refresh();
  });
  const stopCatalog = input.deps.extensionRuntimeCatalog.subscribeInvalidation(() => void refresh());
  return {
    activity: scheduler.activity,
    refresh,
    async dispose() {
      unsubscribe?.();
      stopStorage?.();
      stopCatalog();
      await scheduler.dispose();
    },
  };
};
