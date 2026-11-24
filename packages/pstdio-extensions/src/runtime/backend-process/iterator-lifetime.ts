/** Give each remote reader its own cancellation, including when return queues behind an active read. */
export const openIterator = (open: (...args: unknown[]) => unknown, args: unknown[], index: number) => {
  const controller = new AbortController();
  const options = args[index] as { signal?: AbortSignal } | undefined;
  const signal = options?.signal ? AbortSignal.any([controller.signal, options.signal]) : controller.signal;
  const input = args.slice();
  input[index] = { ...options, signal };
  const iterable = open(...input) as AsyncIterable<unknown>;
  return {
    [Symbol.asyncIterator]() {
      const reader = iterable[Symbol.asyncIterator]();
      return {
        next: () => reader.next(),
        return(value?: unknown) {
          controller.abort();
          return reader.return?.(value) ?? Promise.resolve({ done: true, value });
        },
      };
    },
  };
};
