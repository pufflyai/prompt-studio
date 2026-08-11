import { findCatchupMinute } from "./catchup";
import { createBunCronFactory } from "./cron-backend";
import { startActiveRun } from "./run-handler";
import type { CronHandle, Job, Logger, RunReason, Scheduler, SchedulerInput } from "./types";
import { createInMemoryWatermarkStore, floorToMinute, toMinuteEpoch } from "./watermark-store";

const noopLogger: Logger = { info: () => {}, error: () => {} };

type ActiveJob = {
  job: Job;
  handle: CronHandle;
  inFlight: Promise<void> | null;
  runId: string | null;
  catchupChecked: boolean;
};

export const createScheduler = (input: SchedulerInput): Scheduler => {
  const now = input.now ?? (() => new Date());
  const logger = input.logger ?? noopLogger;
  const cronFactory = input.cron ?? createBunCronFactory();
  const watermarkStore = input.watermarks ?? createInMemoryWatermarkStore();

  const active = new Map<string, ActiveJob>();
  const watermarks = new Map<string, number>();
  const inFlight = new Set<Promise<void>>();

  let disposed = false;
  let watermarksLoaded = false;
  let refreshPromise: Promise<void> | null = null;
  let pendingRefresh = false;
  let watermarkWriteQueue = Promise.resolve();

  const persistWatermarks = () => {
    const snapshot = new Map(watermarks);
    watermarkWriteQueue = watermarkWriteQueue.then(async () => {
      try {
        await watermarkStore.save(snapshot);
      } catch (err) {
        logger.error({ err, event: "scheduler.watermark.persist.error" }, "Failed to persist scheduler watermarks");
      }
    });
  };

  const ensureWatermarksLoaded = async () => {
    if (watermarksLoaded) return;
    watermarksLoaded = true;

    try {
      const loaded = await watermarkStore.load();
      for (const [key, value] of loaded) {
        watermarks.set(key, value);
      }
    } catch {
      // No persisted watermarks yet.
    }
  };

  const tryClaimMinute = (jobKey: string, minuteEpoch: number) => {
    const persisted = watermarks.get(jobKey);
    if (persisted !== undefined && minuteEpoch <= persisted) return false;

    watermarks.set(jobKey, minuteEpoch);
    persistWatermarks();
    return true;
  };

  const dispatchRun = (entry: ActiveJob, scheduledFor: Date, reason: RunReason) => {
    if (disposed) return null;
    if (entry.inFlight) return null;

    const minuteEpoch = toMinuteEpoch(scheduledFor);
    if (!tryClaimMinute(entry.job.key, minuteEpoch)) return null;

    const ctx = {
      runId: crypto.randomUUID(),
      scheduledFor,
      reason,
    };

    const activeRun = startActiveRun({ job: entry.job, ctx, runJob: input.runJob, logger });

    const tracked = activeRun.completion.finally(() => {
      entry.inFlight = null;
      entry.runId = null;
    });
    entry.inFlight = tracked;
    entry.runId = ctx.runId;

    const awaitable = activeRun.awaitableForShutdown.finally(() => {
      inFlight.delete(awaitable);
    });
    inFlight.add(awaitable);

    return tracked;
  };

  const armJob = (job: Job): ActiveJob => {
    const entry: ActiveJob = {
      job,
      handle: { stop: () => {} },
      inFlight: null,
      runId: null,
      catchupChecked: false,
    };

    entry.handle = cronFactory(job.cron, async () => {
      const scheduledFor = floorToMinute(now());
      const tracked = dispatchRun(entry, scheduledFor, "live");
      if (tracked) await tracked;
    });

    return entry;
  };

  const runCatchupOnce = (entry: ActiveJob) => {
    if (entry.catchupChecked) return;
    entry.catchupChecked = true;

    const nowMinute = floorToMinute(now());
    const catchupMinute = findCatchupMinute({
      cron: entry.job.cron,
      lastWatermark: watermarks.get(entry.job.key),
      nowMinute,
    });

    if (catchupMinute === null) return;
    dispatchRun(entry, catchupMinute, "catchup");
  };

  const doRefresh = async () => {
    if (disposed) return;

    let jobs: Job[];
    try {
      jobs = await input.listJobs();
    } catch (err) {
      logger.error({ err, event: "scheduler.refresh.error" }, "Failed to list scheduler jobs");
      return;
    }

    await ensureWatermarksLoaded();

    const seen = new Set<string>();

    for (const job of jobs) {
      seen.add(job.key);
      const existing = active.get(job.key);

      if (existing && existing.job.cron === job.cron) {
        existing.job = job;
        runCatchupOnce(existing);
        continue;
      }

      if (existing) existing.handle.stop();

      const entry = armJob(job);
      active.set(job.key, entry);
      runCatchupOnce(entry);
    }

    for (const [key, entry] of active) {
      if (seen.has(key)) continue;
      entry.handle.stop();
      active.delete(key);
    }
  };

  const refresh = async () => {
    if (disposed) return;

    if (refreshPromise) {
      pendingRefresh = true;
      await refreshPromise;
      return;
    }

    refreshPromise = (async () => {
      try {
        await doRefresh();
        while (pendingRefresh && !disposed) {
          pendingRefresh = false;
          await doRefresh();
        }
      } catch (err) {
        logger.error({ err, event: "scheduler.refresh.error" }, "Scheduler refresh failed");
      }
    })().finally(() => {
      refreshPromise = null;
    });

    await refreshPromise;
  };

  // Kick off the first load. Callers drive subsequent refreshes via refresh().
  void refresh();

  return {
    activity: () =>
      [...active.values()].flatMap((entry) => (entry.runId ? [{ id: entry.runId, label: entry.job.key }] : [])),
    refresh,
    async dispose() {
      disposed = true;
      await refreshPromise;
      for (const entry of active.values()) entry.handle.stop();
      active.clear();
      await Promise.allSettled([...inFlight]);
      await watermarkWriteQueue;
    },
  };
};
