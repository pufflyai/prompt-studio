import { afterEach, expect, test } from "bun:test";
import { checkedStream, multipartSize } from "./streams";

let cleanup = () => {};
afterEach(() => {
  const release = cleanup;
  cleanup = () => {};
  release();
});

test("cancelling a download interrupts a pending source read", async () => {
  const reading = Promise.withResolvers<void>();
  let cancelled = false;
  const source = new ReadableStream<Uint8Array>(
    {
      start(controller) {
        cleanup = () => {
          if (!cancelled) controller.close();
        };
      },
      pull() {
        reading.resolve();
        return new Promise(() => {});
      },
      cancel() {
        cancelled = true;
      },
    },
    { highWaterMark: 0 },
  );
  const stream = checkedStream(source, {
    sha256: new Bun.CryptoHasher("sha256").digest("hex"),
    byteLength: 0,
  });
  await reading.promise;
  await stream.cancel("reader disconnected");
  expect(cancelled).toBe(true);
});

test("cancelling an unread download releases its source", async () => {
  let cancelled = false;
  const source = new ReadableStream<Uint8Array>(
    {
      cancel() {
        cancelled = true;
      },
    },
    { highWaterMark: 0 },
  );
  const stream = checkedStream(source, {
    sha256: new Bun.CryptoHasher("sha256").digest("hex"),
    byteLength: 0,
  });
  await stream.cancel();
  expect(cancelled).toBe(true);
});

test("a slow consumer does not drain the complete source into memory", async () => {
  const chunk = new Uint8Array(64 * 1024).fill(3);
  const count = 80;
  const hash = new Bun.CryptoHasher("sha256");
  for (let index = 0; index < count; index++) hash.update(chunk);
  let produced = 0;
  const source = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        produced++;
        controller.enqueue(chunk);
        if (produced === count) controller.close();
      },
    },
    new ByteLengthQueuingStrategy({ highWaterMark: chunk.byteLength }),
  );
  const stream = checkedStream(source, { sha256: hash.digest("hex"), byteLength: count * chunk.byteLength });
  const reader = stream.getReader();
  expect((await reader.read()).value).toEqual(chunk);
  for (let index = 0; index < 20; index++) await Promise.resolve();
  expect(produced).toBeLessThan(count);
  console.log(
    JSON.stringify({
      phase: "paused download",
      producedBytes: produced * chunk.byteLength,
      totalBytes: count * chunk.byteLength,
      ...process.memoryUsage(),
    }),
  );
  await reader.cancel();
});

test("multipart sizing follows the backend part count without adding a smaller product limit", () => {
  expect(multipartSize(1)).toBe(5 * 1024 * 1024);
  const large = 5 * 1024 ** 3 * 10_000;
  expect(multipartSize(large)).toBe(5 * 1024 ** 3);
  expect(Math.ceil(large / multipartSize(large))).toBe(10_000);
});
