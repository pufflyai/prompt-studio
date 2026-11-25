import { expect, test } from "bun:test";
import { readBounded } from "./io";

test("cancelling a stalled upload releases its stream owner without waiting for bytes", async () => {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    cancel() {
      cancelled = true;
    },
  });
  const controller = new AbortController();
  const read = readBounded(body, 16, controller.signal);
  controller.abort();
  await expect(read).rejects.toThrow();
  expect(cancelled).toBe(true);
  expect(body.locked).toBe(false);
});
