export const acquireOwnerStreamReader = (source: ReadableStream<unknown>) => {
  let byob: ReadableStreamBYOBReader | undefined;
  try {
    byob = source.getReader({ mode: "byob" });
  } catch {
    // Ordinary streams reject a BYOB reader; a locked stream also rejects the
    // default reader below, preserving the original stream's ownership rule.
  }
  if (byob) {
    const reader = byob;
    return {
      bytes: true,
      read: () => reader.read(new Uint8Array(64 * 1024)),
      cancel: (reason?: unknown) => reader.cancel(reason),
      release: () => reader.releaseLock(),
    };
  }
  const reader = source.getReader();
  return {
    bytes: false,
    read: () => reader.read(),
    cancel: (reason?: unknown) => reader.cancel(reason),
    release: () => reader.releaseLock(),
  };
};

interface PullController {
  enqueue: (value: unknown) => void;
  close: () => void;
  error: (reason: unknown) => void;
}

export interface OwnerStreamReadResult {
  done: boolean;
  value?: unknown;
}

export const createOwnerReadableStream = (input: {
  bytes: boolean;
  read: () => Promise<OwnerStreamReadResult>;
  cancel: (reason?: unknown) => Promise<unknown>;
  release: () => void;
}) => {
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    input.release();
  };
  const pull = async (controller: PullController) => {
    try {
      const next = await input.read();
      if (next.done) {
        controller.close();
        finish();
      } else controller.enqueue(next.value);
    } catch (error) {
      controller.error(error);
      finish();
    }
  };
  const cancel = async (reason: unknown) => {
    try {
      await input.cancel(reason);
    } finally {
      finish();
    }
  };
  // Neither stream adapters nor transport read ahead of the consumer.
  if (!input.bytes) return new ReadableStream({ pull, cancel }, { highWaterMark: 0 });
  return new ReadableStream(
    {
      type: "bytes",
      pull: (controller) =>
        pull({
          enqueue: (value) => controller.enqueue(value as Uint8Array<ArrayBuffer>),
          error: (error) => controller.error(error),
          close: () => {
            controller.close();
            controller.byobRequest?.respond(0);
          },
        }),
      cancel,
    },
    { highWaterMark: 0 },
  );
};
