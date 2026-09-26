// A database read may not support cancellation. Keep its promise alive until it
// settles, then reject before the caller can start another child operation.
export const createReadBoundary =
  (signal?: AbortSignal) =>
  async <T>(read: () => Promise<T>) => {
    signal?.throwIfAborted();
    const value = await read();
    signal?.throwIfAborted();
    return value;
  };
