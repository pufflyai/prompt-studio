export const openAssetTransferSource = (
  source: (offset: number, signal: AbortSignal) => Promise<ReadableStream<Uint8Array>>,
  offset: number,
  signal: AbortSignal,
) =>
  new Promise<ReadableStream<Uint8Array>>((resolve, reject) => {
    signal.throwIfAborted();
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    source(offset, signal).then(
      (stream) => {
        signal.removeEventListener("abort", abort);
        if (signal.aborted) void stream.cancel(signal.reason).catch(() => undefined);
        else resolve(stream);
      },
      (error) => {
        signal.removeEventListener("abort", abort);
        reject(error);
      },
    );
  });
