import { expect, test } from "bun:test";
import { createOwnerEndpoint } from "./endpoint";
import type { OwnerMessage } from "./protocol";

test("ReadableStream readers preserve bytes and release their invocation after exhaustion", async () => {
  const host = createOwnerEndpoint((message: OwnerMessage) => void remote.receive(message));
  const remote = createOwnerEndpoint((message: OwnerMessage) => void host.receive(message));
  remote.register((context) => {
    let read = false;
    return new ReadableStream({
      async pull(controller) {
        if (read) controller.close();
        else {
          read = true;
          controller.enqueue(await (context as { read: () => Promise<Uint8Array> }).read());
        }
      },
    });
  }, "stream");
  try {
    for (let index = 0; index < 150; index++) {
      const result = await host.call("stream", [{ read: async () => new Uint8Array([index]) }]);
      expect(result).toBeInstanceOf(ReadableStream);
      const reader = (result as ReadableStream<Uint8Array>).getReader();
      expect((await reader.read()).value).toEqual(new Uint8Array([index]));
      expect(await reader.read()).toEqual({ done: true, value: undefined });
      reader.releaseLock();
    }
    expect(host.stats()).toMatchObject({ handles: 0, pending: 0, signals: 0 });
    expect(remote.stats()).toMatchObject({ handles: 1, pending: 0, signals: 0 });
  } finally {
    host.close(new Error("test finished"));
    remote.close(new Error("test finished"));
  }
});

test("reader cancellation reaches the source with its reason and releases its context", async () => {
  const host = createOwnerEndpoint((message: OwnerMessage) => void remote.receive(message));
  const remote = createOwnerEndpoint((message: OwnerMessage) => void host.receive(message));
  let cancelled: unknown;
  remote.register(
    (context) =>
      new ReadableStream({
        pull: async (controller) => controller.enqueue(await (context as { read: () => Promise<string> }).read()),
        cancel: (reason) => {
          cancelled = reason;
        },
      }),
    "stream",
  );
  try {
    const result = await host.call("stream", [{ read: async () => "value" }]);
    const reader = (result as ReadableStream<string>).getReader();
    expect((await reader.read()).value).toBe("value");
    await reader.cancel("finished");
    expect(cancelled).toBe("finished");
    expect(host.stats()).toMatchObject({ handles: 0, pending: 0, signals: 0 });
    expect(remote.stats()).toMatchObject({ handles: 1, pending: 0, signals: 0 });
  } finally {
    host.close(new Error("test finished"));
    remote.close(new Error("test finished"));
  }
});

test("byte streams retain BYOB readers and finish a pending read when the source closes", async () => {
  const host = createOwnerEndpoint((message: OwnerMessage) => void remote.receive(message));
  const remote = createOwnerEndpoint((message: OwnerMessage) => void host.receive(message));
  let sent = false;
  remote.register(
    () =>
      new ReadableStream({
        type: "bytes",
        pull(controller) {
          if (sent) {
            controller.close();
            controller.byobRequest?.respond(0);
          } else {
            sent = true;
            controller.enqueue(new Uint8Array([1, 2, 3]));
          }
        },
      }),
    "bytes",
  );
  try {
    const result = await host.call("bytes", []);
    const reader = (result as ReadableStream<Uint8Array>).getReader({ mode: "byob" });
    expect((await reader.read(new Uint8Array(8))).value).toEqual(new Uint8Array([1, 2, 3]));
    expect((await reader.read(new Uint8Array(8))).done).toBe(true);
    reader.releaseLock();
    expect(remote.stats()).toMatchObject({ handles: 1, pending: 0 });
  } finally {
    host.close(new Error("test finished"));
    remote.close(new Error("test finished"));
  }
});

test("stream cancellation preserves Error reasons and their machine-readable code", async () => {
  const host = createOwnerEndpoint((message: OwnerMessage) => void remote.receive(message));
  const remote = createOwnerEndpoint((message: OwnerMessage) => void host.receive(message));
  let cancelled: unknown;
  remote.register(
    () =>
      new ReadableStream({
        cancel: (reason) => {
          cancelled = reason;
        },
      }),
    "stream",
  );
  try {
    const stream = (await host.call("stream", [])) as ReadableStream;
    await stream.cancel(Object.assign(new Error("finished"), { code: "consumer_closed" }));
    expect(cancelled).toBeInstanceOf(Error);
    expect(cancelled).toMatchObject({ message: "finished", code: "consumer_closed" });
  } finally {
    host.close(new Error("test finished"));
    remote.close(new Error("test finished"));
  }
});

test("transport does not pull before demand and rejects an unsupported chunk without retaining handles", async () => {
  const host = createOwnerEndpoint((message: OwnerMessage) => void remote.receive(message));
  const remote = createOwnerEndpoint((message: OwnerMessage) => void host.receive(message));
  let pulls = 0;
  let cancelled = false;
  remote.register(
    () =>
      new ReadableStream(
        {
          pull: (controller) => {
            pulls++;
            controller.enqueue(Symbol("unsupported"));
          },
          cancel: () => {
            cancelled = true;
          },
        },
        { highWaterMark: 0 },
      ),
    "stream",
  );
  try {
    const stream = (await host.call("stream", [])) as ReadableStream;
    await Bun.sleep(0);
    expect(pulls).toBe(0);
    const reader = stream.getReader();
    const error = await reader.read().catch((error) => error);
    expect(error.message).toContain("Unsupported extension payload: symbol");
    await Bun.sleep(0);
    expect(cancelled).toBe(true);
    expect(remote.stats()).toMatchObject({ handles: 1, pending: 0 });
    expect(host.stats()).toMatchObject({ handles: 0, pending: 0 });
    reader.releaseLock();
  } finally {
    host.close(new Error("test finished"));
    remote.close(new Error("test finished"));
  }
});

test("a result completing after bridge closure cannot export fresh handles or leave its stream open", async () => {
  const processing: Promise<void>[] = [];
  const host = createOwnerEndpoint((message: OwnerMessage) => {
    processing.push(remote.receive(message));
  });
  const remote = createOwnerEndpoint((message: OwnerMessage) => void host.receive(message));
  const result = Promise.withResolvers<unknown>();
  let cancelled = false;
  remote.register(() => result.promise, "late");
  const failure = host.call("late", []).catch((error) => error);
  host.close(new Error("test closed"));
  remote.close(new Error("test closed"));
  result.resolve(
    new ReadableStream({
      cancel: () => {
        cancelled = true;
      },
    }),
  );
  await Promise.all(processing);
  const failed = await failure;
  expect(failed).toBeInstanceOf(Error);
  expect((failed as Error).message).toBe("test closed");
  expect(cancelled).toBe(true);
  expect(remote.stats()).toMatchObject({ handles: 0, pending: 0, signals: 0 });
});
