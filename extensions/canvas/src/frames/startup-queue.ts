const startupConcurrency = 4;

export const createFrameStartupQueue = () => {
  const jobs = new Set<{ start: () => void; started: boolean }>();
  let active = 0;
  let disposed = false;
  const pump = () => {
    for (const job of jobs) {
      if (active === startupConcurrency) break;
      if (job.started) continue;
      job.started = true;
      active++;
      job.start();
    }
  };
  return {
    enqueue: (start: () => void) => {
      const job = { start, started: false };
      if (!disposed) {
        jobs.add(job);
        pump();
      }
      return {
        finish: () => {
          if (!jobs.delete(job)) return;
          if (job.started) active--;
          pump();
        },
      };
    },
    dispose: () => {
      disposed = true;
      jobs.clear();
      active = 0;
    },
  };
};
