import type { CronFactory, CronHandle } from "./types";

export const createBunCronFactory = (): CronFactory => {
  return (cron, handler) => {
    const job = Bun.cron(cron, handler);
    job.unref?.();
    const handle: CronHandle = {
      stop: () => job.stop(),
    };
    return handle;
  };
};
