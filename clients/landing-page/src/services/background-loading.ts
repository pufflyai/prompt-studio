/** Start after the first paint, then warm one optional module at a time between frames. */
export const loadInBackground = (loaders: (() => Promise<unknown>)[]) => {
  let cancelled = false;
  let index = 0;
  let cancelPending = () => {};
  const next = () => {
    if (cancelled || index === loaders.length) return;
    const load = () => {
      if (cancelled) return;
      // A failed prefetch must not interrupt the scene; first use can retry it.
      void loaders[index++]()
        .catch(() => {})
        .finally(next);
    };
    if (window.requestIdleCallback) {
      const idle = window.requestIdleCallback(load);
      cancelPending = () => window.cancelIdleCallback(idle);
    } else {
      const timer = window.setTimeout(load, 0);
      cancelPending = () => window.clearTimeout(timer);
    }
  };
  let frame = requestAnimationFrame(() => {
    frame = requestAnimationFrame(next);
  });
  return () => {
    cancelled = true;
    cancelAnimationFrame(frame);
    cancelPending();
  };
};
