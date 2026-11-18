// Local database reads can resolve through microtasks alone. Share one yield across
// a burst of reads so the host can receive user requests and cancellation between pages.
let deadline = 0;
let nextTurn: Promise<void> | undefined;
const readTurn = () => {
  if (!nextTurn) {
    deadline = performance.now() + 8;
    nextTurn = new Promise<void>((resolve) => {
      setImmediate(() => {
        nextTurn = undefined;
        resolve();
      });
    });
  } else if (performance.now() >= deadline) {
    return nextTurn;
  }
};

// A database read may not support cancellation. Keep its promise alive until it
// settles, then reject before the caller can start another child operation.
export const createReadBoundary =
  (signal?: AbortSignal) =>
  async <T>(read: () => Promise<T>) => {
    signal?.throwIfAborted();
    const resume = readTurn();
    if (resume) {
      await resume;
      signal?.throwIfAborted();
    }
    const value = await read();
    signal?.throwIfAborted();
    return value;
  };
