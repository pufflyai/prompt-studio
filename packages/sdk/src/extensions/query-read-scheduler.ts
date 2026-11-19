// Experiments may define this when building the SDK. Ordinary builds keep microtask admission.
declare const __PSTDIO_QUERY_EVENT_WINDOW_MS__: number;
const defaultWindowMs = typeof __PSTDIO_QUERY_EVENT_WINDOW_MS__ === "number" ? __PSTDIO_QUERY_EVENT_WINDOW_MS__ : 0;

const scheduleTimer = (task: () => void, delay: number) => {
  const timer = setTimeout(task, delay);
  return () => clearTimeout(timer);
};

/** Admit one automatic read at the first event's deadline; later events do not postpone it. */
export const createQueryReadScheduler = (
  allowed: () => boolean,
  read: () => Promise<unknown>,
  input: { windowMs?: number; schedule?: typeof scheduleTimer } = {},
) => {
  const windowMs = input.windowMs ?? defaultWindowMs;
  if (!Number.isFinite(windowMs) || windowMs < 0) throw new Error("Query event window must be finite and nonnegative");
  let scheduled = false;
  let generation = 0;
  let stop: (() => void) | undefined;
  const cancel = () => {
    generation++;
    scheduled = false;
    stop?.();
    stop = undefined;
  };
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    const issued = ++generation;
    const flush = () => {
      if (!scheduled || generation !== issued) return;
      scheduled = false;
      stop = undefined;
      if (allowed()) void read().catch(() => undefined);
    };
    if (windowMs > 0) stop = (input.schedule ?? scheduleTimer)(flush, windowMs);
    else queueMicrotask(flush);
  };
  return Object.assign(schedule, { cancel });
};
