import { afterAll, beforeAll, expect, test } from "bun:test";
import { AsyncLocalStorage } from "node:async_hooks";
import { getEventListeners } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createStorageMigration } from "pstdio-api-contracts";
import { createExtensionProcessEnvironment } from "../process-environment";
import { extensionContextSurface } from "./context-surface";
import { HANDLER_MARKER } from "./protocol";
import { startBackendWorker } from "./supervisor";
import type { BackendSurface } from "./surface";

let root: string;
let entryPath: string;

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "backend-callbacks-"));
  entryPath = join(root, "extension.ts");
  await writeFile(
    entryPath,
    `
const cleanup = Promise.withResolvers();
let lateOpen;
export default {
  commands: [
    { id: "migration", run(ctx) {
      return ctx.storage.scope({ type: "test", id: "scope" }).migrate(1, async (previous, migration) => {
        await migration.moveCollection("legacy", { keyPrefix: "record-" });
        const id = migration.id("entry");
        const position = migration.position(1, "entry");
        return ctx.storage.set("migrated", { previous, id, position });
      });
    } },
    { id: "idle", async run(ctx, close) {
      const iterator = ctx.live.follow()[Symbol.asyncIterator]();
      void iterator.next().catch(() => {});
      await ctx.live.reading();
      if (close === "invalid result") {
        const send = process.send.bind(process);
        process.send = (message) => send(message.type === "result" && message.ok
          ? { ...message, value: { $pstdioSignal: { aborted: true, reason: { error: null } } } }
          : message);
        return;
      }
      if (close) await iterator.return();
    } },
    { id: "pending", async run(ctx) {
      await ctx.live.listen(async () => {
        await ctx.live.markCallbackRunning();
        await new Promise(() => {});
      });
    } },
    { id: "cancel", run(ctx) {
      return ctx.live.migration(async () => {
        await ctx.live.markCallbackRunning();
        await new Promise(() => {});
      });
    } },
    { id: "cancel-cleanup", async run(ctx) {
      try {
        await ctx.live.runCallback(async () => {
          const handle = await ctx.live.open();
          try {
            await ctx.live.wait();
          } finally {
            const close = await handle.close().then(() => "released", (error) => error.message);
            const touch = await handle.touch().then(() => "ran", () => "refused");
            cleanup.resolve({ close, touch });
          }
        });
      } finally {
        await cleanup.promise;
      }
    } },
    { id: "cleanup-result", run() {
      return cleanup.promise;
    } },
    { id: "watch-context", async run(ctx) {
      await ctx.live.listen(() => ctx.live.read());
      return ctx.live.wait();
    } },
    { id: "publish-context", run(ctx) {
      return ctx.live.publish();
    } },
    { id: "live-callback", run(ctx) {
      return ctx.live.runCallback(() => ctx.live.wait());
    } },
    { id: "late", async run(ctx) {
      lateOpen = ctx.live.open();
      void lateOpen.catch(() => {});
      await ctx.live.opening();
    } },
    { id: "close-late", async run() {
      const handle = await lateOpen;
      lateOpen = undefined;
      await handle.close();
    } },
    { id: "retained-argument", async run(ctx) {
      let stored;
      await ctx.live.offer((listener) => { stored = listener; });
      return { call: async () => stored("after settlement") };
    } },
    { id: "open-result", run(ctx) {
      return ctx.live.open();
    } },
    { id: "callable-iterator", async run(ctx) {
      const iterator = (await ctx.live.open())[Symbol.asyncIterator]();
      return { next: () => iterator.next(), close: () => iterator.return() };
    } },
    { id: "unsubscribe", async run(ctx) {
      let seen = 0;
      const handle = ctx.live.observe(() => { seen += 1; });
      handle.close();
      await ctx.live.update();
      return seen;
    } },
    { id: "signal", async run(ctx) {
      const controller = new AbortController();
      const waiting = ctx.live.wait({ signal: controller.signal });
      await ctx.live.reading();
      controller.abort(new Error("worker selected abort reason"));
      return waiting;
    } },
    { id: "signal-listener", run(ctx) {
      return ctx.live.withSignal(async (signal) => signal.aborted);
    } },
    { id: "record", run(ctx) {
      return ctx.live.record(JSON.parse('{"__proto__":"literal data","label":"ordinary record"}'));
    } },
  ],
};
`,
  );
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

const withWorker = async (run: (invoke: Invoke) => Promise<void>) => {
  const worker = await startBackendWorker({
    command: [
      process.execPath,
      "-e",
      `import { runBackendWorker } from ${JSON.stringify(pathToFileURL(join(import.meta.dir, "worker.ts")).href)}; runBackendWorker();`,
    ],
    env: createExtensionProcessEnvironment(),
    entryPath,
  });
  try {
    const commands = (worker.definition as { commands: { id: string; run: { [HANDLER_MARKER]: string } }[] }).commands;
    await run((id, input) => {
      const handlerId = commands.find((entry) => entry.id === id)?.run[HANDLER_MARKER];
      if (!handlerId) throw new Error(`Unknown command: ${id}`);
      return worker.invoke({ ...input, handlerId, args: input.args ?? [] });
    });
  } finally {
    await worker.stop();
  }
};

type Invoke = (
  id: string,
  input: { context: unknown; surface: BackendSurface; args?: unknown[]; signal?: AbortSignal },
) => Promise<unknown>;

const fixture = (live: Record<string, unknown>, kinds: Record<string, BackendSurface> = {}) => ({
  context: { live },
  surface: {
    kind: "object",
    members: {
      live: {
        kind: "object",
        members: Object.fromEntries(Object.keys(live).map((name) => [name, kinds[name] ?? { kind: "async" }])),
      },
    },
  } satisfies BackendSurface,
});

const deadline = <T>(promise: Promise<T>) =>
  Promise.race([
    promise,
    Bun.sleep(2_000).then(() => {
      throw new Error("Host work did not settle");
    }),
  ]);

test("migration callbacks use synchronous helpers and keep the host migration scope in reentrant calls", async () => {
  await withWorker(async (invoke) => {
    const scope = new AsyncLocalStorage<string>();
    const migration = createStorageMigration(["sample", "project", "test", "scope", 1]);
    const write = Promise.withResolvers<unknown>();
    const context = {
      extensionId: "sample",
      projectId: "project",
      storage: {
        scope: () => ({
          migrate: (_version: number, callback: (previous: number, helpers: object) => Promise<void>) =>
            scope.run("migration", () =>
              callback(0, {
                ...migration,
                moveCollection() {
                  expect(scope.getStore()).toBe("migration");
                },
              }),
            ),
        }),
        set: (key: string, value: unknown) => {
          expect(key).toBe("migrated");
          expect(scope.getStore()).toBe("migration");
          write.resolve(value);
        },
      },
    };
    await invoke("migration", { context, surface: extensionContextSurface(context) });
    expect(await write.promise).toEqual({
      previous: 0,
      id: migration.id("entry"),
      position: migration.position(1, "entry"),
    });
  });
});

for (const [close, reason] of [
  [false, "handler settlement"],
  [true, "return"],
  ["invalid result", "an unreadable worker result"],
] as const) {
  test(`a pending iterator read is interrupted by ${reason}`, async () => {
    await withWorker(async (invoke) => {
      const reading = Promise.withResolvers<void>();
      const released = Promise.withResolvers<void>();
      const fallback = new AbortController();
      const base = fixture(
        {
          reading: () => reading.promise,
          async *follow(options?: { signal?: AbortSignal }) {
            const signal = options?.signal ?? fallback.signal;
            try {
              reading.resolve();
              await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));
            } finally {
              released.resolve();
            }
          },
        },
        { follow: { kind: "iterate", signalArg: 0 } },
      );
      try {
        const result = deadline(invoke("idle", { ...base, args: [close] }));
        if (close === "invalid result") await expect(result).rejects.toBeInstanceOf(TypeError);
        else await result;
        await deadline(released.promise);
      } finally {
        fallback.abort();
      }
    });
  });
}

test("settlement rejects an outstanding callback and closes a late host handle", async () => {
  await withWorker(async (invoke) => {
    const running = Promise.withResolvers<void>();
    let reply: Promise<unknown> | undefined;
    await invoke(
      "pending",
      fixture({
        async listen(callback: () => Promise<unknown>) {
          reply = callback();
          await running.promise;
        },
        markCallbackRunning: () => running.resolve(),
      }),
    );
    expect(reply).toBeDefined();
    await expect(deadline(reply!)).rejects.toThrow("invocation");

    const opening = Promise.withResolvers<void>();
    const available = Promise.withResolvers<object>();
    const closed = Promise.withResolvers<void>();
    await invoke(
      "late",
      fixture({
        open: () => {
          opening.resolve();
          return available.promise;
        },
        opening: () => opening.promise,
      }),
    );
    available.resolve({ close: () => closed.resolve() });
    await deadline(invoke("close-late", fixture({})));
    await deadline(closed.promise);
  });
});

test("a live result can call a host callback passed to it during the handler", async () => {
  await withWorker(async (invoke) => {
    const session = (await deadline(
      invoke(
        "retained-argument",
        fixture({
          offer: (accept: (listener: (value: string) => string) => Promise<void>) =>
            accept((value) => `received ${value}`),
        }),
      ),
    )) as { call: () => Promise<string> };
    expect(await deadline(session.call())).toBe("received after settlement");
  });
});

test("a failed host reply closes exported and unvisited handles once", async () => {
  const closed = { before: 0, after: 0 };
  await withWorker(async (invoke) => {
    const before = { close: () => closed.before++ };
    const after = { close: () => closed.after++ };
    await expect(
      deadline(
        invoke(
          "open-result",
          fixture({ open: () => ({ before, invalid: { $pstdioFunction: "collision" }, after, alias: before }) }),
        ),
      ),
    ).rejects.toThrow("cannot use the keys");
    expect(closed).toEqual({ before: 1, after: 1 });
  });
  expect(closed).toEqual({ before: 1, after: 1 });
});

test("a revoked host reply closes handles alongside an unreadable property", async () => {
  await withWorker(async (invoke) => {
    const controller = new AbortController();
    const opening = Promise.withResolvers<void>();
    const available = Promise.withResolvers<object>();
    const closed = Promise.withResolvers<void>();
    const running = invoke("open-result", {
      ...fixture({
        open: () => {
          opening.resolve();
          return available.promise;
        },
      }),
      signal: controller.signal,
    }).catch((error: unknown) => error);
    try {
      await deadline(opening.promise);
      controller.abort(new Error("cancelled host reply"));
      expect(await deadline(running)).toMatchObject({ message: "cancelled host reply" });
      available.resolve({
        get metadata() {
          throw new Error("unreadable metadata");
        },
        handle: { close: () => closed.resolve() },
      });
      await deadline(closed.promise);
    } finally {
      available.resolve({});
    }
  });
});

test("a callable async iterable remains readable while a worker result owns its iterator", async () => {
  await withWorker(async (invoke) => {
    const source = Promise.withResolvers<void>();
    const callable = Object.assign(() => "called directly", {
      async *[Symbol.asyncIterator]() {
        try {
          yield "first";
          yield "second";
        } finally {
          source.resolve();
        }
      },
    });
    const session = (await deadline(invoke("callable-iterator", fixture({ open: () => callable })))) as {
      next: () => Promise<IteratorResult<string>>;
      close: () => Promise<IteratorResult<string>>;
    };
    expect(await deadline(session.next())).toEqual({ done: false, value: "first" });
    expect(await deadline(session.next())).toEqual({ done: false, value: "second" });
    expect((await deadline(session.close())).done).toBe(true);
    await deadline(source.promise);
  });
});

test("cancelling a handler unblocks its host callback without affecting another invocation", async () => {
  await withWorker(async (invoke) => {
    const running = Promise.withResolvers<void>();
    const released = Promise.withResolvers<void>();
    const controller = new AbortController();
    const cancellation = new Error("cancel migration");
    const unrelated = Promise.withResolvers<string>();
    const waiting = Promise.withResolvers<void>();
    const other = invoke(
      "live-callback",
      fixture({
        runCallback: (callback: () => Promise<unknown>) => callback(),
        wait: () => {
          waiting.resolve();
          return unrelated.promise;
        },
      }),
    );
    await deadline(waiting.promise);
    const result = invoke("cancel", {
      ...fixture({
        async migration(callback: () => Promise<unknown>) {
          try {
            await callback();
          } finally {
            released.resolve();
          }
        },
        markCallbackRunning: () => running.resolve(),
      }),
      signal: controller.signal,
    });
    const outcome = result.catch((error) => error);
    await deadline(running.promise);
    controller.abort(cancellation);
    expect(await outcome).toBe(cancellation);
    unrelated.resolve("unrelated callback finished");
    expect(await deadline(other)).toBe("unrelated callback finished");
    await deadline(released.promise);
  });
});

test("draining a cancelled callback may close its existing handle but cannot call other functions", async () => {
  await withWorker(async (invoke) => {
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const controller = new AbortController();
    const cancellation = new Error("cancel callback");
    let closes = 0;
    let touches = 0;
    const result = invoke("cancel-cleanup", {
      ...fixture({
        runCallback: (callback: () => Promise<unknown>) => callback(),
        open: () => ({
          close: () => closes++,
          touch: () => touches++,
        }),
        wait: () => {
          entered.resolve();
          return release.promise;
        },
      }),
      signal: controller.signal,
    }).catch((error) => error);
    try {
      await deadline(entered.promise);
      controller.abort(cancellation);
      expect(await result).toBe(cancellation);
      expect(await deadline(invoke("cleanup-result", fixture({})))).toEqual({
        close: "released",
        touch: "refused",
      });
      expect(closes).toBe(1);
      expect(touches).toBe(0);
    } finally {
      release.resolve();
    }
  });
});

test("callbacks keep their invocation's context when another invocation delivers an event", async () => {
  await withWorker(async (invoke) => {
    const scope = new AsyncLocalStorage<string>();
    const subscribed = Promise.withResolvers<void>();
    const finished = Promise.withResolvers<void>();
    let listener: (() => Promise<unknown>) | undefined;
    const watching = scope.run("watching", () =>
      invoke(
        "watch-context",
        fixture({
          listen(callback: () => Promise<unknown>) {
            listener = callback;
            subscribed.resolve();
          },
          read: () => scope.getStore(),
          wait: () => finished.promise,
        }),
      ),
    );
    try {
      await deadline(subscribed.promise);
      const read = await scope.run("publishing", () =>
        invoke("publish-context", fixture({ publish: () => listener?.() })),
      );
      expect(read).toBe("watching");
    } finally {
      finished.resolve();
      await watching;
    }
  });
});

test("closing a synchronous subscription immediately stops delivery", async () => {
  await withWorker(async (invoke) => {
    let listener: (() => Promise<void>) | undefined;
    const closed = Promise.withResolvers<void>();
    const count = await invoke(
      "unsubscribe",
      fixture(
        {
          observe(callback: () => Promise<void>) {
            listener = callback;
            return {
              close() {
                listener = undefined;
                closed.resolve();
              },
            };
          },
          update: () => listener?.(),
        },
        { observe: { kind: "subscribe" } },
      ),
    );
    expect(count).toBe(0);
    await deadline(closed.promise);
  });
});

test("forwarded signals preserve the cancellation reason and detach listeners on settlement", async () => {
  await withWorker(async (invoke) => {
    const reading = Promise.withResolvers<void>();
    const reason = await invoke(
      "signal",
      fixture({
        reading: () => reading.promise,
        wait({ signal }: { signal: AbortSignal }) {
          return new Promise((resolve) => {
            signal.addEventListener("abort", () => resolve(signal.reason.message), { once: true });
            reading.resolve();
          });
        },
      }),
    );
    expect(reason).toBe("worker selected abort reason");

    const signal = new AbortController().signal;
    expect(
      await invoke(
        "signal-listener",
        fixture({
          withSignal: (callback: (signal: AbortSignal) => Promise<unknown>) => callback(signal),
        }),
      ),
    ).toBe(false);
    expect(getEventListeners(signal, "abort")).toHaveLength(0);
  });
});

test("both sides preserve JSON keys as own data properties", async () => {
  await withWorker(async (invoke) => {
    const value = await invoke("record", fixture({ record: (data: unknown) => data }));
    expect(Object.hasOwn(value as object, "__proto__")).toBe(true);
    expect((value as Record<string, unknown>).__proto__).toBe("literal data");
  });
});
