interface HeartbeatMonitorOptions {
  intervalMs?: number;
  threshold: number;
  onConnectionLost: () => void;
}

export interface HeartbeatMonitor {
  start: () => void;
  stop: () => void;
  tick: () => void;
  recordHeartbeat: () => void;
}

export const createHeartbeatMonitor = (options: HeartbeatMonitorOptions): HeartbeatMonitor => {
  const { intervalMs, threshold, onConnectionLost } = options;
  let missedCount = 0;
  let fired = false;
  let stopped = false;
  let timerId: ReturnType<typeof setInterval> | null = null;

  const tick = () => {
    if (stopped) return;
    missedCount++;
    if (missedCount >= threshold && !fired) {
      fired = true;
      onConnectionLost();
    }
  };

  return {
    start: () => {
      missedCount = 0;
      fired = false;
      stopped = false;
      if (intervalMs) {
        timerId = setInterval(tick, intervalMs);
      }
    },
    stop: () => {
      stopped = true;
      if (timerId !== null) {
        clearInterval(timerId);
        timerId = null;
      }
    },
    tick,
    recordHeartbeat: () => {
      missedCount = 0;
      fired = false;
    },
  };
};
