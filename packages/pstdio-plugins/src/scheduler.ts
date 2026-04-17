import type { HookClient } from "@pstdio/sdk/hooks";
import { cronMatchesTime } from "./cron";
import type { ResolvedSchedule } from "./types";

export type ScheduleOutcome = {
  projectId: string;
  pluginIdentity: string;
  scheduleName: string;
  scheduledFor: string;
  runId: string;
  durationMs: number;
  outcome: "started" | "succeeded" | "failed" | "timed_out" | "skipped_overlap";
};

export type ScheduleEntry = ResolvedSchedule;

export type ScheduleContext = {
  client: HookClient;
  prompts: Record<string, string>;
};

type SchedulerOptions = {
  projectId: string;
  createContext?: () => ScheduleContext;
  onOutcome?: (outcome: ScheduleOutcome) => void;
};

const TICK_INTERVAL_MS = 60_000;
const DEFAULT_TIMEOUT_MS = 300_000; // 5 minutes

const generateRunId = () => crypto.randomUUID();

const floorToMinute = (date: Date) => {
  const d = new Date(date);
  d.setUTCSeconds(0, 0);
  return d;
};

export const createScheduler = (options: SchedulerOptions) => {
  const { projectId, createContext, onOutcome } = options;

  let entries: ScheduleEntry[] = [];
  let stopped = false;
  let tickTimer: ReturnType<typeof setInterval> | null = null;
  const inFlight = new Map<string, Promise<void>>();
  const lastRunAt = new Map<string, string>();

  const reportOutcome = (
    entry: ScheduleEntry,
    scheduledFor: Date,
    runId: string,
    startMs: number,
    outcome: ScheduleOutcome["outcome"],
  ) => {
    onOutcome?.({
      projectId,
      pluginIdentity: entry.pluginIdentity,
      scheduleName: entry.scheduleName,
      scheduledFor: scheduledFor.toISOString(),
      runId,
      durationMs: Date.now() - startMs,
      outcome,
    });
  };

  const executeEntry = async (entry: ScheduleEntry, scheduledFor: Date) => {
    const runId = generateRunId();
    const startMs = Date.now();
    const timeoutMs = entry.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    const scheduleCtx = createContext?.() ?? { client: {} as HookClient, prompts: {} };

    const ctx = {
      client: scheduleCtx.client,
      projectId,
      prompts: scheduleCtx.prompts,
      trigger: {
        type: "schedule" as const,
        scheduleName: entry.scheduleName,
        scheduledFor: scheduledFor.toISOString(),
        runId,
      },
    };

    reportOutcome(entry, scheduledFor, runId, startMs, "started");

    try {
      const result = Promise.resolve(entry.trigger(ctx));
      const timeout = new Promise<"timed_out">((resolve) => setTimeout(() => resolve("timed_out"), timeoutMs));

      const winner = await Promise.race([result.then(() => "done" as const), timeout]);

      if (winner === "timed_out") {
        reportOutcome(entry, scheduledFor, runId, startMs, "timed_out");
      } else {
        reportOutcome(entry, scheduledFor, runId, startMs, "succeeded");
      }
    } catch {
      reportOutcome(entry, scheduledFor, runId, startMs, "failed");
    }
  };

  const runDueEntries = async (now: Date) => {
    if (stopped) return;

    const minute = floorToMinute(now);
    const minuteKey = minute.toISOString();

    const tasks: Promise<void>[] = [];

    for (const entry of entries) {
      if (lastRunAt.get(entry.compositeKey) === minuteKey) continue;
      if (!cronMatchesTime(entry.cron, minute)) continue;

      if (inFlight.has(entry.compositeKey)) {
        onOutcome?.({
          projectId,
          pluginIdentity: entry.pluginIdentity,
          scheduleName: entry.scheduleName,
          scheduledFor: minuteKey,
          runId: "",
          durationMs: 0,
          outcome: "skipped_overlap",
        });
        continue;
      }

      lastRunAt.set(entry.compositeKey, minuteKey);

      const runPromise = executeEntry(entry, minute).finally(() => {
        inFlight.delete(entry.compositeKey);
      });

      inFlight.set(entry.compositeKey, runPromise);
      tasks.push(runPromise);
    }

    await Promise.allSettled(tasks);
  };

  const startTickLoop = () => {
    if (tickTimer || stopped) return;
    tickTimer = setInterval(() => {
      runDueEntries(new Date());
    }, TICK_INTERVAL_MS);
  };

  const stop = async () => {
    stopped = true;
    if (tickTimer) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
    await Promise.allSettled([...inFlight.values()]);
  };

  return {
    setEntries(newEntries: ScheduleEntry[]) {
      entries = [...newEntries];
      for (const key of lastRunAt.keys()) {
        if (!entries.some((e) => e.compositeKey === key)) {
          lastRunAt.delete(key);
        }
      }
    },

    runDueEntries,
    startTickLoop,
    stop,
  };
};
