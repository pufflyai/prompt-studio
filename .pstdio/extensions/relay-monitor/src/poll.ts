import type { Snapshot } from "./model";

export const poll = (
  query: { refresh(signal: AbortSignal): Promise<Snapshot> },
  publish: (value: Snapshot) => void,
  fail: () => void,
  loading: (value: boolean) => void,
) => {
  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let active: AbortController | undefined;
  const allowed = (controller: AbortController) => !disposed && !controller.signal.aborted;
  const next = () => {
    if (!disposed && !document.hidden) timer = setTimeout(() => void read(), 30_000);
  };
  const read = async () => {
    if (disposed || document.hidden || active) return;
    const controller = new AbortController();
    active = controller;
    loading(true);
    try {
      const value = await query.refresh(controller.signal);
      if (allowed(controller)) publish(value);
    } catch {
      if (allowed(controller)) fail();
    } finally {
      active = undefined;
      if (!disposed) loading(false);
      next();
    }
  };
  const refresh = () => {
    clearTimeout(timer);
    void read();
  };
  const visibility = () => {
    clearTimeout(timer);
    if (document.hidden) active?.abort();
    else refresh();
  };
  document.addEventListener("visibilitychange", visibility);
  refresh();
  return {
    refresh,
    stop() {
      disposed = true;
      active?.abort();
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", visibility);
    },
  };
};
