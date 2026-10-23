import { expect, test } from "bun:test";
import { readExactResponse } from "./exact-response";

test("manifest overflow cancels the stream without reading its remaining body", async () => {
  let pulls = 0;
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        pulls++;
        controller.enqueue(new Uint8Array([1, 2]));
      },
      cancel() {
        cancelled = true;
      },
    },
    { highWaterMark: 0 },
  );
  await expect(readExactResponse(new Response(stream), 3)).rejects.toThrow("length exceeds");
  expect(pulls).toBe(2);
  expect(cancelled).toBe(true);
  expect(stream.locked).toBe(false);
});

test("manifest length mismatch cancels before consuming or allocating the body", async () => {
  let pulls = 0;
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>(
    {
      pull() {
        pulls++;
      },
      cancel() {
        cancelled = true;
      },
    },
    { highWaterMark: 0 },
  );
  await expect(
    readExactResponse(new Response(stream, { headers: { "pstdio-byte-length": "5000000000" } }), 3),
  ).rejects.toThrow("length differs");
  expect(pulls).toBe(0);
  expect(cancelled).toBe(true);
});

test("manifest stream errors propagate and release the reader", async () => {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.error(new Error("connection interrupted"));
    },
  });
  await expect(readExactResponse(new Response(stream), 3)).rejects.toThrow("connection interrupted");
  expect(stream.locked).toBe(false);
});

test("manifest downloads accept exact chunked bodies", async () => {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array([1]));
      controller.enqueue(new Uint8Array([2, 3]));
      controller.close();
    },
  });
  expect(await readExactResponse(new Response(stream), 3)).toEqual(new Uint8Array([1, 2, 3]));
});
