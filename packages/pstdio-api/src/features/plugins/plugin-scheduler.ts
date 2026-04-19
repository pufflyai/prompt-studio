import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { PluginRuntime } from "pstdio-plugins/hooks";
import { apiLogger } from "../../lib/logger";
import {
  createActiveRun,
  cronMatchesMinute,
  floorToMinute,
  parseWatermarks,
  type ScheduleRunReason,
  serializeWatermarks,
  toMinuteEpoch,
} from "./plugin-scheduler-shared";

type RuntimeSchedule = ReturnType<PluginRuntime["schedules"]["list"]>[number];

type ScheduleEntry = {
  key: string;
  projectId: string;
  runtime: PluginRuntime;
  schedule: RuntimeSchedule;
  running: boolean;
  inFlight: Promise<void> | null;
  lastFiredMinute: number | null;
  startupCatchupChecked: boolean;
  stale: boolean;
};

type SchedulerRuntimeStore = {
  getForProject(projectId: string): Promise<PluginRuntime>;
};

type SchedulerInput = {
  runtimeStore: SchedulerRuntimeStore;
  listProjectIds: () => Promise<string[]>;
  tickIntervalMs: number;
  now: () => Date;
  watermarkPath: string;
};

const findStartupCatchupMinute = (entry: ScheduleEntry, nowMinute: Date, watermarks: Map<string, number>) => {
  const lastAttemptedMinute = watermarks.get(entry.key);
  if (lastAttemptedMinute === undefined) return null;

  let cursor = Bun.cron.parse(entry.schedule.cron, new Date(lastAttemptedMinute * 60_000));
  if (cursor === null) return null;

  let previous: Date | null = null;

  for (let i = 0; i < 200_000; i += 1) {
    if (cursor.getTime() >= nowMinute.getTime()) break;

    previous = cursor;
    const next = Bun.cron.parse(entry.schedule.cron, cursor);
    if (next === null) break;
    cursor = next;
  }

  if (previous === null) return null;
  if (toMinuteEpoch(previous) <= lastAttemptedMinute) return null;
  return previous;
};

const markAttemptedMinute = (entry: ScheduleEntry, minuteEpoch: number, watermarks: Map<string, number>) => {
  const current = watermarks.get(entry.key);
  if (current !== undefined && minuteEpoch <= current) return false;

  watermarks.set(entry.key, minuteEpoch);
  return true;
};

export const createScheduler = (input: SchedulerInput) => {
  const entries = new Map<string, ScheduleEntry>();
  const inFlight = new Set<Promise<void>>();
  const watermarks = new Map<string, number>();

  let disposed = false;
  let watermarksLoaded = false;
  let tickPromise: Promise<void> | null = null;
  let watermarkWriteQueue = Promise.resolve();

  const persistWatermarks = () => {
    watermarkWriteQueue = watermarkWriteQueue.then(async () => {
      try {
        await mkdir(dirname(input.watermarkPath), { recursive: true });
        await writeFile(input.watermarkPath, serializeWatermarks(watermarks), "utf8");
      } catch (err) {
        apiLogger.error(
          { err, event: "plugin.schedule.watermark.persist.error" },
          "Failed to persist schedule watermarks",
        );
      }
    });
  };

  const ensureWatermarksLoaded = async () => {
    if (watermarksLoaded) return;

    try {
      const raw = await readFile(input.watermarkPath, "utf8");
      for (const [key, value] of parseWatermarks(raw)) {
        watermarks.set(key, value);
      }
    } catch {
      // No persisted watermark yet.
    }

    watermarksLoaded = true;
  };

  const scheduleRun = (entry: ScheduleEntry, scheduledFor: Date, runReason: ScheduleRunReason) => {
    const minuteEpoch = toMinuteEpoch(scheduledFor);
    if (entry.lastFiredMinute === minuteEpoch) return;

    const persisted = watermarks.get(entry.key);
    if (persisted !== undefined && minuteEpoch <= persisted) {
      entry.lastFiredMinute = minuteEpoch;
      return;
    }

    entry.lastFiredMinute = minuteEpoch;
    if (markAttemptedMinute(entry, minuteEpoch, watermarks)) {
      persistWatermarks();
    }

    if (entry.running) {
      apiLogger.info(
        {
          event: "plugin.schedule.skipped_overlap",
          scheduleKey: entry.key,
          pluginIdentity: entry.schedule.pluginIdentity,
          projectId: entry.projectId,
          scheduleName: entry.schedule.scheduleName,
          scheduledFor: scheduledFor.toISOString(),
        },
        "Skipped overlapping scheduled plugin run",
      );
      return;
    }

    entry.running = true;
    const activeRun = createActiveRun(
      entry,
      ({ runId, scheduledFor: scheduledForIso }) =>
        entry.runtime.schedules.trigger({
          schedule: entry.schedule,
          projectId: entry.projectId,
          runId,
          scheduledFor: scheduledForIso,
        }),
      scheduledFor,
      runReason,
    );

    entry.inFlight = activeRun.completion.finally(() => {
      entry.running = false;
      entry.inFlight = null;
      if (entry.stale) entries.delete(entry.key);
    });

    const awaitableForShutdown = activeRun.awaitableForShutdown.finally(() => {
      inFlight.delete(awaitableForShutdown);
    });
    inFlight.add(awaitableForShutdown);
  };

  const refreshEntries = async () => {
    const projectIds = await input.listProjectIds();
    const seenKeys = new Set<string>();

    const loadProjectSchedules = async (projectId: string) => {
      let runtime: PluginRuntime;

      try {
        runtime = await input.runtimeStore.getForProject(projectId);
      } catch (err) {
        apiLogger.error(
          { err, event: "plugin.schedule.project.load.error", projectId },
          "Failed to load project plugin runtime for scheduler",
        );
        return;
      }

      for (const schedule of runtime.schedules.list()) {
        const key = `${projectId}/${schedule.key}`;
        seenKeys.add(key);

        const existing = entries.get(key);
        if (existing) {
          existing.runtime = runtime;
          existing.schedule = schedule;
          existing.stale = false;
          continue;
        }

        entries.set(key, {
          key,
          projectId,
          runtime,
          schedule,
          running: false,
          inFlight: null,
          lastFiredMinute: watermarks.get(key) ?? null,
          startupCatchupChecked: false,
          stale: false,
        });
      }
    };

    for (const projectId of projectIds) {
      await loadProjectSchedules(projectId);
    }

    for (const [key, entry] of entries) {
      if (seenKeys.has(key)) continue;
      if (entry.running) {
        entry.stale = true;
        continue;
      }

      entries.delete(key);
    }
  };

  const runTick = async () => {
    if (disposed) return;

    await ensureWatermarksLoaded();
    await refreshEntries();
    const nowMinute = floorToMinute(input.now());
    const nowMinuteEpoch = toMinuteEpoch(nowMinute);

    const evaluateEntry = (entry: ScheduleEntry) => {
      if (!entry.startupCatchupChecked) {
        entry.startupCatchupChecked = true;
        const catchupMinute = findStartupCatchupMinute(entry, nowMinute, watermarks);
        if (catchupMinute !== null) {
          scheduleRun(entry, catchupMinute, "startup_catchup");
        }
      }

      if (!cronMatchesMinute(entry.schedule.cron, nowMinute)) return;
      const lastAttemptedMinute = watermarks.get(entry.key);
      if (lastAttemptedMinute !== undefined && lastAttemptedMinute >= nowMinuteEpoch) return;

      scheduleRun(entry, nowMinute, "live_tick");
    };

    for (const entry of entries.values()) {
      try {
        evaluateEntry(entry);
      } catch (err) {
        apiLogger.error(
          {
            err,
            event: "plugin.schedule.entry.tick.error",
            projectId: entry.projectId,
            scheduleKey: entry.key,
            scheduleName: entry.schedule.scheduleName,
          },
          "Failed to evaluate scheduled entry",
        );
      }
    }
  };

  const kickTick = () => {
    if (tickPromise) return;
    tickPromise = runTick()
      .catch((err) => {
        apiLogger.error({ err, event: "plugin.schedule.tick.error" }, "Scheduled plugin tick failed");
      })
      .finally(() => {
        tickPromise = null;
      });
  };

  const interval = setInterval(kickTick, input.tickIntervalMs);
  kickTick();

  return {
    async dispose() {
      disposed = true;
      clearInterval(interval);
      await tickPromise;
      await Promise.allSettled([...inFlight]);
      await watermarkWriteQueue;
    },
  };
};
