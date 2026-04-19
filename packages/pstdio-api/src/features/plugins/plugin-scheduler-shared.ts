import { apiLogger } from "../../lib/logger";

export type ScheduleRunReason = "live_tick" | "startup_catchup";
type ScheduleOutcome = "success" | "error" | "timed_out";

type SchedulableEntry = {
  key: string;
  projectId: string;
  schedule: {
    pluginIdentity: string;
    scheduleName: string;
    timeoutMs: number;
  };
};

export type ActiveRun = {
  completion: Promise<void>;
  awaitableForShutdown: Promise<void>;
};

export const toMinuteEpoch = (value: Date) => Math.floor(value.getTime() / 60_000);
export const floorToMinute = (value: Date) => new Date(toMinuteEpoch(value) * 60_000);

export const cronMatchesMinute = (cron: string, minute: Date) => {
  const candidate = Bun.cron.parse(cron, new Date(minute.getTime() - 1));
  return candidate !== null && candidate.getTime() === minute.getTime();
};

export const parseWatermarks = (raw: string) => {
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const watermarks = new Map<string, number>();

  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    watermarks.set(key, value);
  }

  return watermarks;
};

export const serializeWatermarks = (watermarks: Map<string, number>) => {
  const payload = Object.fromEntries([...watermarks.entries()].sort(([a], [b]) => a.localeCompare(b)));
  return `${JSON.stringify(payload, null, 2)}\n`;
};

const logScheduleResult = (input: {
  entry: SchedulableEntry;
  runId: string;
  scheduledFor: string;
  runReason: ScheduleRunReason;
  outcome: ScheduleOutcome;
  durationMs: number;
  err?: unknown;
}) => {
  const payload = {
    event: "plugin.schedule.run",
    scheduleKey: input.entry.key,
    pluginIdentity: input.entry.schedule.pluginIdentity,
    projectId: input.entry.projectId,
    scheduleName: input.entry.schedule.scheduleName,
    runId: input.runId,
    scheduledFor: input.scheduledFor,
    runReason: input.runReason,
    outcome: input.outcome,
    durationMs: input.durationMs,
  };

  if (input.outcome === "error") {
    apiLogger.error({ ...payload, err: input.err }, "Scheduled plugin handler failed");
    return;
  }

  apiLogger.info(payload, "Scheduled plugin handler completed");
};

export const createActiveRun = (
  entry: SchedulableEntry,
  scheduleTrigger: (input: { runId: string; scheduledFor: string }) => Promise<void>,
  scheduledFor: Date,
  runReason: ScheduleRunReason,
): ActiveRun => {
  const runId = crypto.randomUUID();
  const startedAt = Date.now();
  const scheduledForIso = scheduledFor.toISOString();
  let timedOut = false;
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  const completion = scheduleTrigger({ runId, scheduledFor: scheduledForIso })
    .then(() => {
      if (timedOut) return;
      logScheduleResult({
        entry,
        runId,
        scheduledFor: scheduledForIso,
        runReason,
        outcome: "success",
        durationMs: Date.now() - startedAt,
      });
    })
    .catch((err) => {
      if (timedOut) return;
      logScheduleResult({
        entry,
        runId,
        scheduledFor: scheduledForIso,
        runReason,
        outcome: "error",
        durationMs: Date.now() - startedAt,
        err,
      });
    })
    .finally(() => {
      if (timeoutHandle !== null) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }
    });

  const awaitableForShutdown = new Promise<void>((resolve) => {
    let resolved = false;
    const resolveOnce = () => {
      if (resolved) return;
      resolved = true;
      resolve();
    };

    timeoutHandle = setTimeout(() => {
      timedOut = true;
      logScheduleResult({
        entry,
        runId,
        scheduledFor: scheduledForIso,
        runReason,
        outcome: "timed_out",
        durationMs: Date.now() - startedAt,
      });
      resolveOnce();
    }, entry.schedule.timeoutMs);
    timeoutHandle.unref?.();

    completion.finally(resolveOnce);
  });

  return { completion, awaitableForShutdown };
};
