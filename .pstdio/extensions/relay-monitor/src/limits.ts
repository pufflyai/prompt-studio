const queue: { start: () => void; signal: AbortSignal; abort: () => void }[] = [];
let active = 0;
const drain = () => {
  while (active < 2 && queue.length) {
    const next = queue.shift()!;
    next.signal.removeEventListener("abort", next.abort);
    next.start();
  }
};
export const acquireQuery = (signal: AbortSignal) =>
  new Promise<() => void>((resolve, reject) => {
    signal.throwIfAborted();
    if (queue.length >= 8) {
      reject(new Error("Monitoring query capacity reached"));
      return;
    }
    const entry = {
      signal,
      start: () => {
        active++;
        resolve(() => {
          active--;
          drain();
        });
      },
      abort: () => {
        queue.splice(queue.indexOf(entry), 1);
        reject(new Error("Monitoring query cancelled"));
      },
    };
    if (active < 2) entry.start();
    else {
      queue.push(entry);
      signal.addEventListener("abort", entry.abort, { once: true });
    }
  });
