// Waiting runs stay queued in the database; only their wake-up timers are local.
export const createDelayedExecution = (execute: (id: string) => void) => {
  const waiting = new Map<string, ReturnType<typeof setTimeout>>();
  let closed = false;
  const cancel = (id: string) => {
    clearTimeout(waiting.get(id));
    waiting.delete(id);
  };
  const start = (id: string, notBefore: string | undefined) => {
    if (closed || waiting.has(id)) return;
    const due = notBefore ? Date.parse(notBefore) : 0;
    const wake = () => {
      waiting.delete(id);
      if (closed) return;
      const remaining = due - Date.now();
      if (remaining > 0) {
        const timer = setTimeout(wake, Math.min(remaining, 2_147_483_647));
        timer.unref();
        waiting.set(id, timer);
      } else execute(id);
    };
    wake();
  };
  return {
    start,
    cancel,
    close() {
      closed = true;
      for (const id of waiting.keys()) cancel(id);
    },
  };
};
