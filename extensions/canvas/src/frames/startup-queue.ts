export const FRAME_STARTUP_CONCURRENCY = 4;

export const createFrameStartupQueue = () => {
  const jobs = new Set<{ start: () => void; priority: number; started: boolean }>();
  let active = 0;
  let scheduled: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;
  const pump = () => {
    scheduled = undefined;
    const waiting = [...jobs].filter((job) => !job.started).sort((a, b) => a.priority - b.priority);
    for (const job of waiting) {
      if (active === FRAME_STARTUP_CONCURRENCY) break;
      job.started = true;
      active++;
      job.start();
    }
  };
  const schedule = () => {
    if (!disposed && scheduled === undefined) scheduled = setTimeout(pump, 0);
  };
  return {
    enqueue: (start: () => void, priority: number) => {
      const job = { start, priority, started: false };
      if (!disposed) {
        jobs.add(job);
        schedule();
      }
      const finish = () => {
        if (!jobs.delete(job)) return;
        if (job.started) active--;
        schedule();
      };
      return {
        finish,
        cancel: finish,
        prioritize: (value: number) => {
          job.priority = value;
          schedule();
        },
      };
    },
    dispose: () => {
      disposed = true;
      clearTimeout(scheduled);
      jobs.clear();
      active = 0;
    },
  };
};
