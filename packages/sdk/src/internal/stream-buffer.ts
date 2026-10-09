/** One consumer owns each buffer. Every close wakes a pending read. */
export const createStreamBuffer = <T>(input: {
  size: (value: T) => number;
  limit: number;
  onConsume?: (bytes: number) => void;
  onCancel: () => void | Promise<void>;
}) => {
  const queue: { value: T; bytes: number }[] = [];
  let bytes = 0;
  let ended = false;
  let error: unknown;
  let wake = () => {};
  let consumed = false;
  const finish = (reason?: unknown) => {
    ended = true;
    error = reason;
    if (reason) {
      queue.length = 0;
      bytes = 0;
    }
    wake();
  };
  return {
    push(value: T) {
      if (ended) return true;
      const size = input.size(value);
      if (bytes + size > input.limit) return false;
      queue.push({ value, bytes: size });
      bytes += size;
      wake();
      return true;
    },
    finish,
    clear() {
      queue.length = 0;
      bytes = 0;
      finish();
    },
    iterable: {
      [Symbol.asyncIterator]() {
        if (consumed) throw new Error("Command streams support one consumer");
        consumed = true;
        return {
          async next(): Promise<IteratorResult<T>> {
            while (!queue.length && !ended)
              await new Promise<void>((resolve) => {
                wake = resolve;
              });
            const item = queue.shift();
            if (item) {
              bytes -= item.bytes;
              input.onConsume?.(item.bytes);
              return { done: false, value: item.value };
            }
            if (error) throw error;
            return { done: true, value: undefined };
          },
          async return(): Promise<IteratorResult<T>> {
            queue.length = 0;
            bytes = 0;
            await input.onCancel();
            finish();
            return { done: true, value: undefined };
          },
        };
      },
    },
  };
};

export const streamError = (code: string, message = code) => Object.assign(new Error(message), { code });
export const jsonBytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).byteLength;
