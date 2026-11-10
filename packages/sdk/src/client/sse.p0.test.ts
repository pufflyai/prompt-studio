import { expect, test } from "bun:test";
import { readSseStream } from "./sse";

test("cancellation drains the stream's actual asynchronous close before releasing its reader", async () => {
  const abort = new AbortController();
  const closing = Promise.withResolvers<void>();
  let cancelled = 0;
  let settled = false;
  const body = new ReadableStream<Uint8Array>({
    cancel() {
      cancelled++;
      return closing.promise;
    },
  });
  const reading = readSseStream(body, () => {}, { signal: abort.signal }).then(() => {
    settled = true;
  });
  abort.abort();
  try {
    await Bun.sleep(0);
    expect(cancelled).toBe(1);
    expect(settled).toBe(false);
    expect(body.locked).toBe(true);
  } finally {
    closing.resolve();
    await reading;
  }
  expect(body.locked).toBe(false);
});

test("a stream arriving after cancellation still releases its connection", async () => {
  const abort = new AbortController();
  abort.abort();
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    cancel() {
      cancelled = true;
    },
  });
  await readSseStream(body, () => {}, { signal: abort.signal });
  expect(cancelled).toBe(true);
  expect(body.locked).toBe(false);
});

test("aborting a failed SSE stream reports the read error without leaking a cancellation rejection", async () => {
  const abortController = new AbortController();
  const error = new DOMException("The operation was aborted.", "AbortError");
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      abortController.signal.addEventListener("abort", () => controller.error(error), { once: true });
    },
  });
  const reading = readSseStream(body, () => {}, { signal: abortController.signal });
  queueMicrotask(() => abortController.abort());
  await expect(reading).rejects.toBe(error);
  await Bun.sleep(0);
});
