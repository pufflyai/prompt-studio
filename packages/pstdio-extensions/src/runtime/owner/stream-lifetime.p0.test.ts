import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { createOwnerEndpoint } from "./endpoint";
import type { OwnerMessage } from "./protocol";
import { createExtensionOwner } from "./supervisor";

test("returned streams retain their calling context until exhaustion and release repeated handles", async () => {
  const host = createOwnerEndpoint((message: OwnerMessage) => void remote.receive(message));
  const remote = createOwnerEndpoint((message: OwnerMessage) => void host.receive(message));
  remote.register(async (context) => {
    const ctx = context as { read: () => Promise<string> };
    return {
      async *[Symbol.asyncIterator]() {
        yield await ctx.read();
        yield await ctx.read();
      },
    };
  }, "stream");
  try {
    for (let index = 0; index < 150; index++) {
      const stream = (await host.call("stream", [{ read: async () => `value-${index}` }])) as AsyncIterable<string>;
      const values = [];
      for await (const value of stream) values.push(value);
      expect(values).toEqual([`value-${index}`, `value-${index}`]);
    }
    expect(host.stats()).toMatchObject({ handles: 0, pending: 0, signals: 0 });
    expect(remote.stats()).toMatchObject({ handles: 1, pending: 0, signals: 0 });
  } finally {
    host.close(new Error("test finished"));
    remote.close(new Error("test finished"));
  }
});

test("breaking a returned stream closes its source and releases the host context", async () => {
  let closed = 0;
  const host = createOwnerEndpoint((message: OwnerMessage) => void remote.receive(message));
  const remote = createOwnerEndpoint((message: OwnerMessage) => void host.receive(message));
  remote.register(
    async (context) => ({
      async *[Symbol.asyncIterator]() {
        try {
          yield await (context as { read: () => Promise<string> }).read();
          yield "unused";
        } finally {
          closed++;
        }
      },
    }),
    "stream",
  );
  try {
    const stream = (await host.call("stream", [{ read: async () => "first" }])) as AsyncIterable<string>;
    for await (const value of stream) {
      expect(value).toBe("first");
      break;
    }
    expect(closed).toBe(1);
    expect(host.stats().handles).toBe(0);
    expect(remote.stats().handles).toBe(1);
  } finally {
    host.close(new Error("test finished"));
    remote.close(new Error("test finished"));
  }
});

test("a real returned owner stream keeps its signal and remains supervisor-cancellable", async () => {
  const root = await mkdtemp(join(tmpdir(), "pstdio-owner-stream-"));
  const owner = createExtensionOwner({ path: root });
  const controller = new AbortController();
  try {
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({
        name: "stream",
        publisher: "test",
        version: "1.0.0",
        main: "extension.ts",
        engines: { pstdio: `^${EXTENSION_API_VERSION}` },
      }),
    );
    await writeFile(
      join(root, "extension.ts"),
      `export default { commands: [{
      id: 'stream', ref: { kind: 'command', id: 'stream' }, title: 'Stream', run: (ctx) => ({
        async *[Symbol.asyncIterator]() {
          yield ctx.signal.aborted;
          await ctx.storage.set('started', true);
          while (true) {};
        }
      })
    }] };`,
    );
    const source = await owner.load();
    let started!: () => void;
    const running = new Promise<void>((resolve) => {
      started = resolve;
    });
    const stream = (await source!.definition.commands![0]!.run(
      {
        signal: controller.signal,
        storage: { set: async () => started() },
      } as never,
      {},
    )) as unknown as AsyncIterable<boolean>;
    const iterator = stream[Symbol.asyncIterator]();
    expect(await iterator.next()).toEqual({ value: false, done: false });
    const next = iterator.next().catch((error) => error);
    await running;
    controller.abort();
    expect(await next).toMatchObject({ code: "extension_owner_cancelled" });
  } finally {
    controller.abort();
    await owner.dispose();
    await rm(root, { recursive: true, force: true });
  }
});

test("completed session promises release their one-shot remote handles", async () => {
  const host = createOwnerEndpoint((message: OwnerMessage) => void remote.receive(message));
  const remote = createOwnerEndpoint((message: OwnerMessage) => void host.receive(message));
  remote.register(async () => ({ done: Promise.resolve("finished") }), "session");
  try {
    for (let index = 0; index < 150; index++) {
      const session = (await host.call("session", [])) as { done: Promise<string> };
      expect(await session.done).toBe("finished");
    }
    expect(remote.stats()).toMatchObject({ handles: 1, pending: 0, signals: 0 });
  } finally {
    host.close(new Error("test finished"));
    remote.close(new Error("test finished"));
  }
});
