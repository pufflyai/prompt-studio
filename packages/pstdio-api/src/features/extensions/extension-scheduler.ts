import type { ExtensionLoggerApi, Localizable } from "pstdio-api-contracts/extension-kernel";
import { type CronFactory, createFileWatermarkStore, createScheduler, type Job } from "pstdio-scheduler";
import { apiLogger } from "../../lib/logger";
import type { ScheduleAdmissionDeps } from "./deps";
import { deviceAutomationsOwnerId } from "./device-automations";
import { createScheduleAdmission } from "./extension-schedule-admission";
import { executeScheduledCommand, scheduleInputsCurrent } from "./extension-schedule-admission/execution";
import { automationRunId, createAutomationRunJournal } from "./extension-schedule-admission/runs";

const EXTENSION_SCHEDULE_TIMEOUT_MS = 15_000;
interface Input {
  deps: ScheduleAdmissionDeps;
  listProjectIds: () => Promise<string[]>;
  watermarkPath: string;
  now?: () => Date;
  cron?: CronFactory;
  extensionLogger?: ExtensionLoggerApi;
}
interface ScheduleJobMeta {
  projectId: string;
  scheduleId: string;
  deviceId: string | null;
}
const scheduleTitle = (title: Localizable<string>) =>
  typeof title === "string" ? title : (title.default ?? title.$l10n);

export const createExtensionScheduler = (input: Input) => {
  const initialized = new Set<string>();
  let globalGeneration = 0;
  const projectGenerations = new Map<string, number>();
  const generationFor = (projectId: string) => `${globalGeneration}/${projectGenerations.get(projectId) ?? 0}`;
  const journalFor = (projectId: string) => createAutomationRunJournal(input.deps, projectId);
  const projectJobs = async (projectId: string, seen: Set<string>) => {
    const snapshot = await input.deps.extensionRuntimeCatalog.get(projectId);
    const admit = await createScheduleAdmission(input.deps, projectId, snapshot);
    const jobs: Job[] = [];
    for (const schedule of snapshot.runtime.schedules) {
      const admission = await admit(schedule);
      if (!admission) continue;
      const key = `${projectId}/${schedule.id}`;
      if (admission.definition) {
        seen.add(key);
        if (!initialized.has(key)) {
          await journalFor(projectId).skipThrough(admission.definition, schedule.cron, input.now?.() ?? new Date());
          initialized.add(key);
        }
      }
      jobs.push({
        key,
        label: scheduleTitle(schedule.title),
        description: snapshot.project.name,
        runId: admission.definition ? (date) => automationRunId(projectId, schedule.id, date.toISOString()) : undefined,
        cron: schedule.cron,
        catchup: admission.definition ? "skip" : undefined,
        timeoutMs: EXTENSION_SCHEDULE_TIMEOUT_MS,
        meta: {
          projectId,
          scheduleId: schedule.id,
          deviceId: admission.definition?.deviceId ?? null,
        } satisfies ScheduleJobMeta,
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
      const admit = await createScheduleAdmission(input.deps, meta.projectId, snapshot);
      const admission = await admit(schedule);
      if (!admission || (admission.definition?.deviceId ?? null) !== meta.deviceId) return;
      const journal = journalFor(meta.projectId);
      const runId = admission.definition
        ? await journal.claim(admission.definition, schedule.cron, ctx.scheduledFor)
        : null;
      if (admission.definition && !runId) return;
      try {
        const dispatched = await executeScheduledCommand({
          ...input,
          snapshot,
          schedule,
          workspaceId: admission.workspaceId,
          ctx,
          dispatch: async (execute, contextCurrent) => {
            // Invalidations request another read. Only a change to this run's inputs can reject it.
            while (true) {
              const generation = generationFor(meta.projectId);
              const current = await input.deps.extensionRuntimeCatalog.get(meta.projectId);
              const declaration = current.runtime.schedules.find((candidate) => candidate.id === meta.scheduleId);
              const recheck = await createScheduleAdmission(input.deps, meta.projectId, current);
              const allowed = declaration ? await recheck(declaration) : null;
              const workspaceCurrent = !admission.definition || (await contextCurrent());
              if (generation !== generationFor(meta.projectId)) continue;
              if (
                !allowed ||
                !scheduleInputsCurrent(snapshot, current, schedule) ||
                (allowed.definition?.deviceId ?? null) !== meta.deviceId ||
                allowed.workspaceId !== admission.workspaceId ||
                !workspaceCurrent
              )
                return false;
              // Start dispatch in the same turn as the final stable admission check.
              return execute();
            }
          },
        });
        await journal.finish(runId, dispatched ? "completed" : "skipped");
      } catch (error) {
        await journal.finish(runId, "failed");
        throw error;
      }
    },
  });
  const refresh = (projectId?: string) => {
    if (projectId) projectGenerations.set(projectId, (projectGenerations.get(projectId) ?? 0) + 1);
    else globalGeneration++;
    return scheduler.refresh();
  };
  const unsubscribe = input.deps.eventBus?.subscribe((event) => {
    if (
      ![
        "extension_instances",
        "installed_extension_sources",
        "extension_automation_preferences",
        "projects",
        "workspaces",
      ].includes(event.table)
    )
      return;
    const row = event.data as { project_id?: string; id?: string; scope_type?: string; scope_id?: string };
    const projectId =
      row.project_id ??
      (event.table === "projects" ? row.id : undefined) ??
      (row.scope_type === "project" ? row.scope_id : undefined);
    void refresh(projectId);
  });
  const stopStorage = input.deps.extensionStorageService.watch?.((owner) => {
    if (owner.extensionId === deviceAutomationsOwnerId) void refresh(owner.workbenchId);
  });
  const stopCatalog = input.deps.extensionRuntimeCatalog.subscribeInvalidation(
    ({ projectId }) => void refresh(projectId),
  );
  const stopAccount = input.deps.accountService.watch(() => void refresh());
  return {
    activity: scheduler.activity,
    refresh: () => refresh(),
    async dispose() {
      unsubscribe?.();
      stopStorage?.();
      stopCatalog();
      stopAccount();
      await scheduler.dispose();
    },
  };
};
