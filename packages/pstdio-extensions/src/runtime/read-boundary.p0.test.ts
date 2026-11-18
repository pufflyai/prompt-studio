import { expect, test } from "bun:test";
import { createReadBoundary } from "./read-boundary";

test("a stream of immediately resolved extension reads lets the host cancel it", async () => {
  const controller = new AbortController();
  const read = createReadBoundary(controller.signal);
  const cancel = setImmediate(() => controller.abort());
  let calls = 0;
  const readPages = async () => {
    const deadline = performance.now() + 250;
    while (performance.now() < deadline) {
      await read(async () => {
        calls++;
      });
    }
  };
  try {
    await expect(readPages()).rejects.toThrow();
    expect(calls).toBeGreaterThan(0);
    const stopped = calls;
    await expect(
      read(async () => {
        calls++;
      }),
    ).rejects.toThrow();
    expect(calls).toBe(stopped);
  } finally {
    clearImmediate(cancel);
  }
});
