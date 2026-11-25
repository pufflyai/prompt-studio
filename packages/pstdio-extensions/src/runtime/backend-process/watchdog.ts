/** Defaults, kept generous until they are calibrated on supported hardware (PS-525). */
export const WATCHDOG_DEFAULTS = {
  heartbeatMs: 5_000,
  /** A worker whose event loop does not answer for this long is treated as stuck, e.g. an endless loop. */
  unresponsiveMs: 60_000,
  memoryLimitBytes: 2 * 1024 * 1024 * 1024,
};

export type WatchdogOptions = Partial<typeof WATCHDOG_DEFAULTS>;

/**
 * Watches a worker from outside it. The host pings on an interval; the worker answers from its
 * event loop with its resident memory. No answer within the unresponsive limit, or memory above
 * the limit, stops the worker with a reason every waiting caller receives.
 */
export const createWatchdog = (
  ping: (seq: number) => void,
  terminate: (reason: string) => void,
  options: WatchdogOptions = {},
) => {
  const {
    heartbeatMs = WATCHDOG_DEFAULTS.heartbeatMs,
    unresponsiveMs = WATCHDOG_DEFAULTS.unresponsiveMs,
    memoryLimitBytes = WATCHDOG_DEFAULTS.memoryLimitBytes,
  } = options;
  let seq = 0;
  let lastAnswer = performance.now();
  let lastTick = lastAnswer;
  const timer = setInterval(() => {
    const now = performance.now();
    // A late tick means the host itself was blocked, so pongs may be waiting unread. Start over
    // instead of blaming the worker for the host's stall.
    if (now - lastTick > 2 * heartbeatMs) lastAnswer = now;
    lastTick = now;
    if (now - lastAnswer >= unresponsiveMs) {
      clearInterval(timer);
      terminate(`The extension backend did not respond for ${Math.round(unresponsiveMs / 1000)} s and was stopped.`);
      return;
    }
    ping(seq++);
  }, heartbeatMs);
  timer.unref?.();

  return {
    answered(rss: number) {
      lastAnswer = performance.now();
      if (rss <= memoryLimitBytes) return;
      clearInterval(timer);
      terminate(
        `The extension backend used ${Math.round(rss / 1024 / 1024)} MiB, over its memory limit, and was stopped.`,
      );
    },
    stop: () => clearInterval(timer),
  };
};
