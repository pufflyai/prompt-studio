import { expect, test } from "bun:test";
import { readSseStream } from "./sse";

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
