/** A synchronous event may reach an owner through multiple logical routes. Admit it once. */
export const createQueryReadScheduler = (allowed: () => boolean, read: () => Promise<unknown>) => {
  let scheduled = false;
  return () => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      if (allowed()) void read().catch(() => undefined);
    });
  };
};
