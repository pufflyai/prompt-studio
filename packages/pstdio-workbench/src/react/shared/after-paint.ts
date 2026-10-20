/** Yield a browser paint opportunity before starting work for newly mounted content. */
export const afterPaint = (signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    signal.throwIfAborted();
    let frame = 0;
    const abort = () => {
      cancelAnimationFrame(frame);
      reject(signal.reason);
    };
    signal.addEventListener("abort", abort, { once: true });
    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        signal.removeEventListener("abort", abort);
        resolve();
      });
    });
  });
