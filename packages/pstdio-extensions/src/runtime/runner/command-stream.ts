import type { JsonValue } from "@pstdio/sdk/extensions";

const CHUNK_BYTES = 64 * 1024;
const QUEUE_BYTES = 1024 * 1024;
const QUEUE_CHUNKS = 256;
const closedError = () => Object.assign(new Error("Command stream closed"), { code: "command_stream_closed" });

/** Socket writes are serialized and counted until delivery, including the in-flight chunk. */
export const createCommandStreamWriter = (
  deliver: ((chunk: JsonValue) => Promise<void>) | undefined,
  parentSignal: AbortSignal,
) => {
  const lifetime = new AbortController();
  const signal = AbortSignal.any([parentSignal, lifetime.signal]);
  let bytes = 0;
  let count = 0;
  let tail = Promise.resolve();
  const waiting = new Set<() => void>();
  const wake = () => {
    for (const listener of waiting) listener();
    waiting.clear();
  };

  return {
    close: () => lifetime.abort(),
    async write(chunk: JsonValue) {
      if (!deliver) return;
      if (signal.aborted) throw closedError();
      const json = JSON.stringify(chunk);
      const size = new TextEncoder().encode(json).byteLength;
      if (size > CHUNK_BYTES)
        throw Object.assign(new Error("Command stream chunk exceeds 64 KiB"), {
          code: "command_stream_chunk_too_large",
        });
      while (count >= QUEUE_CHUNKS || bytes + size > QUEUE_BYTES) {
        await new Promise<void>((resolve) => {
          const done = () => {
            signal.removeEventListener("abort", done);
            waiting.delete(done);
            resolve();
          };
          waiting.add(done);
          signal.addEventListener("abort", done, { once: true });
        });
        if (signal.aborted) throw closedError();
      }
      count += 1;
      bytes += size;
      // Snapshot JSON before the caller can mutate a chunk while another write drains.
      const value = JSON.parse(json) as JsonValue;
      const writing = tail.then(async () => {
        if (signal.aborted) throw closedError();
        await deliver(value);
      });
      tail = writing.catch(() => {});
      let onAbort = () => {};
      try {
        await Promise.race([
          writing,
          new Promise<never>((_, reject) => {
            onAbort = () => reject(closedError());
            signal.addEventListener("abort", onAbort, { once: true });
            if (signal.aborted) onAbort();
          }),
        ]);
      } finally {
        signal.removeEventListener("abort", onAbort);
        bytes -= size;
        count -= 1;
        wake();
      }
    },
  };
};
