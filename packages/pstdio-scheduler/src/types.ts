export type RunReason = "live" | "catchup";

export type Job = {
  key: string;
  cron: string;
  timeoutMs: number;
  meta?: Record<string, unknown>;
};

export type RunContext = {
  runId: string;
  scheduledFor: Date;
  reason: RunReason;
};

export type Logger = {
  info: (payload: Record<string, unknown>, msg?: string) => void;
  error: (payload: Record<string, unknown>, msg?: string) => void;
};

export type WatermarkStore = {
  load: () => Promise<Map<string, number>>;
  save: (watermarks: Map<string, number>) => Promise<void>;
};

export type CronHandle = {
  stop: () => void;
};

export type CronFactory = (cron: string, handler: () => void | Promise<void>) => CronHandle;

export type SchedulerInput = {
  listJobs: () => Promise<Job[]>;
  runJob: (job: Job, ctx: RunContext) => Promise<void>;
  watermarks?: WatermarkStore;
  now?: () => Date;
  logger?: Logger;
  cron?: CronFactory;
};

export type Scheduler = {
  activity: () => Array<{ id: string; label: string }>;
  refresh: () => Promise<void>;
  dispose: () => Promise<void>;
};
