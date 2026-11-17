import { expect, test } from "bun:test";
import { createClient } from "./client";

const fixture = () => {
  const closing = Promise.withResolvers<void>();
  const signals: AbortSignal[] = [];
  let cancelled = 0;
  const client = createClient({
    baseUrl: "http://session-api.test",
    fetch: (async (_url, input) => {
      signals.push(input!.signal!);
      return new Response(
        new ReadableStream<Uint8Array>({
          cancel() {
            return ++cancelled === 1 ? closing.promise : undefined;
          },
        }),
      );
    }) as typeof fetch,
  });
  return { client, signals, closing, cancelled: () => cancelled };
};

test("a replacement session connection waits for the previous stream's actual cancellation", async () => {
  const f = fixture();
  const first = f.client.sessions.connectStream("first", {});
  await Bun.sleep(0);
  first.close();
  const second = f.client.sessions.connectStream("second", {});
  try {
    await Bun.sleep(0);
    expect(f.cancelled()).toBe(1);
    expect(f.signals[0]!.aborted).toBe(true);
    expect(f.signals).toHaveLength(1);
    f.closing.resolve();
    await Bun.sleep(0);
    expect(f.signals).toHaveLength(2);
    expect(f.signals[1]!.aborted).toBe(false);
  } finally {
    f.closing.resolve();
    second.close();
  }
});

test("replacement admission waits for an aborted fetch whose headers have not arrived", async () => {
  const pending = Promise.withResolvers<Response>();
  let requests = 0;
  let cancelled = false;
  const client = createClient({
    baseUrl: "http://session-api.test",
    fetch: (async () =>
      ++requests === 1 ? pending.promise : new Response(new ReadableStream())) as unknown as typeof fetch,
  });
  const first = client.sessions.connectStream("first", {});
  first.close();
  const second = client.sessions.connectStream("second", {});
  const release = () =>
    pending.resolve(
      new Response(
        new ReadableStream({
          cancel: () => {
            cancelled = true;
          },
        }),
      ),
    );
  try {
    await Bun.sleep(0);
    expect(requests).toBe(1);
    release();
    await Bun.sleep(0);
    expect(cancelled).toBe(true);
    expect(requests).toBe(2);
  } finally {
    release();
    second.close();
  }
});

test("a replacement released during cancellation cannot open an unobserved connection afterward", async () => {
  const f = fixture();
  const first = f.client.sessions.connectStream("first", {});
  await Bun.sleep(0);
  first.close();
  const second = f.client.sessions.connectStream("second", {});
  second.close();
  try {
    await Bun.sleep(0);
    expect(f.signals).toHaveLength(1);
  } finally {
    f.closing.resolve();
    await Bun.sleep(0);
  }
  expect(f.signals).toHaveLength(1);
});
