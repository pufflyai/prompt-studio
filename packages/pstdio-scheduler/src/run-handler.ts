import type { Job, Logger, RunContext, RunReason } from "./types";

type Outcome = "success" | "error" | "timed_out";

export type ActiveRun = {
  completion: Promise<void>;
  awaitableForShutdown: Promise<void>;
};

const logRun = (input: {
  logger: Logger;
  job: Job;
  runId: string;
  scheduledForIso: string;
  reason: RunReason;
  outcome: Outcome;
  durationMs: number;
  err?: unknown;
}) => {
  const payload = {
    event: "scheduler.run",
    jobKey: input.job.key,
    runId: input.runId,
    scheduledFor: input.scheduledForIso,
    reason: input.reason,
    outcome: input.outcome,
    durationMs: input.durationMs,
    ...(input.job.meta ? { meta: input.job.meta } : {}),
  };

  if (input.outcome === "error") {
    input.logger.error({ ...payload, err: input.err }, "Scheduled handler failed");
    return;
  }

  if (input.outcome === "timed_out") {
    input.logger.info(payload, "Scheduled handler timed out");
    return;
  }

  input.logger.info(payload, "Scheduled handler completed");
};

export const startActiveRun = (input: {
  job: Job;
  ctx: RunContext;
  runJob: (job: Job, ctx: RunContext) => Promise<void>;
  logger: Logger;
}): ActiveRun => {
  const { job, ctx, runJob, logger } = input;
  const startedAt = Date.now();
  const scheduledForIso = ctx.scheduledFor.toISOString();
  let timedOut = false;
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  const completion = Promise.resolve()
    .then(() => runJob(job, ctx))
    .then(() => {
      if (timedOut) return;
      logRun({
        logger,
        job,
        runId: ctx.runId,
        scheduledForIso,
        reason: ctx.reason,
        outcome: "success",
        durationMs: Date.now() - startedAt,
      });
    })
    .catch((err) => {
      if (timedOut) return;
      logRun({
        logger,
        job,
        runId: ctx.runId,
        scheduledForIso,
        reason: ctx.reason,
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
      logRun({
        logger,
        job,
        runId: ctx.runId,
        scheduledForIso,
        reason: ctx.reason,
        outcome: "timed_out",
        durationMs: Date.now() - startedAt,
      });
      resolveOnce();
    }, job.timeoutMs);
    timeoutHandle.unref?.();

    completion.finally(resolveOnce);
  });

  return { completion, awaitableForShutdown };
};
