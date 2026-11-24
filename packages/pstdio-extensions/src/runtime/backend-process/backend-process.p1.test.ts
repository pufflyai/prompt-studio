import { afterAll, beforeAll, expect, spyOn, test } from "bun:test";
import { AsyncLocalStorage } from "node:async_hooks";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createExtensionProcessEnvironment } from "../process-environment";
import { backendWorkerCommand, createBackendWorkerPool } from "./pool";
import { HANDLER_MARKER } from "./protocol";
import { type BackendInvocation, BackendUnavailableError, startBackendWorker } from "./supervisor";
import type { BackendSurface } from "./surface";

let root: string;
let entryPath: string;

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "backend-process-"));
  entryPath = join(root, "extension.ts");
  await writeFile(
    entryPath,
    `
let observedAbort = false;
export default {
  commands: [
    {
      id: "save",
      title: "Save",
      async run(ctx, params) {
        const items = ctx.storage.collection("items");
        await items.put(params.id, { bytes: params.bytes });
        ctx.logger.info("saved " + params.id);
        return { project: ctx.projectId, stored: await items.get(params.id), pid: process.pid };
      },
    },
    { id: "environment", title: "Environment", run: () => ({ ...process.env }) },
    {
      id: "forge",
      title: "Forge",
      run: () =>
        new Promise((resolve) => {
          const listener = (message) => {
            if (message?.type !== "reply" || message.requestId !== "forged") return;
            process.off("message", listener);
            resolve(message.ok ? "accepted" : message.error.code);
          };
          process.on("message", listener);
          process.send({
            v: 1,
            type: "call",
            invocationId: "another-invocation",
            requestId: "forged",
            path: [{ name: "storage" }, { name: "collection", args: ["items"] }, { name: "get" }],
            args: ["a"],
          });
        }),
    },
    {
      id: "wait",
      title: "Wait",
      run: (ctx) => new Promise((resolve) => ctx.signal.addEventListener("abort", () => {
        observedAbort = true;
        resolve("aborted");
      })),
    },
    { id: "observed-abort", title: "Observed abort", run: () => observedAbort },
    { id: "crash", title: "Crash", run: () => process.exit(7) },
    {
      id: "shape",
      title: "Shape",
      run(ctx) {
        const item = { blob: new Blob(["asset bytes"]) };
        const items = { async *[Symbol.asyncIterator]() { yield "entry"; } };
        return ctx.inspect({ first: item, second: item, items });
      },
    },
    { id: "finish", title: "Finish", run: (ctx) => ctx.finish() },
    {
      id: "edges",
      title: "Edges",
      async run(ctx) {
        await ctx.live.listen(() => { throw new Error("listener failed"); });
        const entity = await ctx.live.entity();
        const controller = new AbortController();
        const waiting = ctx.live.wait({ signal: controller.signal });
        controller.abort();
        const aborted = await waiting;
        const follow = ctx.live.follow()[Symbol.asyncIterator]();
        await follow.next();
        return { entityKeys: Object.keys(entity), hasMethod: typeof entity.reveal, aborted };
      },
    },
    {
      id: "live",
      title: "Live",
      async run(ctx) {
        const doubled = await ctx.live.apply(async (value) => value * 2, 21);
        const handle = await ctx.live.open();
        const closed = await handle.close();
        const entries = [];
        for await (const entry of ctx.live.follow()) entries.push(entry);
        return { doubled, closed, entries };
      },
    },
    {
      id: "disconnect",
      title: "Disconnect",
      run: () => {
        process.removeAllListeners("disconnect");
        process.disconnect();
        return new Promise(() => {});
      },
    },
    { id: "log-and-fail", title: "Log", run: (ctx) => { ctx.logger.info("x"); throw Object.assign(new Error("boom"), { code: "backend_unavailable" }); } },
  ],
};
`,
  );
});

test("a definition keeps class methods and rejects values the host cannot receive", async () => {
  const classEntry = join(root, "class-extension.ts");
  await writeFile(
    classEntry,
    `class Save { id = "save"; run() { return this.id; } }\nexport default { commands: [new Save()] };`,
  );
  const worker = await startBackendWorker({
    command: backendWorkerCommand(),
    env: createExtensionProcessEnvironment(),
    entryPath: classEntry,
  });
  try {
    expect(
      await worker.invoke({ handlerId: handlerOf(worker.definition, "save"), context: {}, surface, args: [] }),
    ).toBe("save");
  } finally {
    await worker.stop();
  }
  const mapEntry = join(root, "map-extension.ts");
  await writeFile(mapEntry, `export default { commands: [{ id: "m", run: () => 1, options: new Map() }] };`);
  await expect(
    startBackendWorker({
      command: backendWorkerCommand(),
      env: createExtensionProcessEnvironment(),
      entryPath: mapEntry,
    }),
  ).rejects.toThrow("default.commands[0].options cannot be sent");
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

const surface: BackendSurface = {
  kind: "object",
  members: {
    projectId: { kind: "value" },
    signal: { kind: "signal" },
    logger: { kind: "object", members: { info: { kind: "notify" } } },
    storage: {
      kind: "object",
      members: {
        collection: {
          kind: "factory",
          returns: { kind: "object", members: { get: { kind: "async" }, put: { kind: "async" } } },
        },
      },
    },
  },
};

const hostContext = () => {
  const items = new Map<string, unknown>();
  const logs: string[] = [];
  const collection = (name: string) => ({
    get: async (id: string) => items.get(`${name}/${id}`),
    put: async (id: string, value: unknown) => {
      items.set(`${name}/${id}`, value);
    },
    secret: async () => "host-only",
  });
  return {
    logs,
    context: { projectId: "p1", logger: { info: (line: string) => logs.push(line) }, storage: { collection } },
  };
};

const start = (env = createExtensionProcessEnvironment()) =>
  startBackendWorker({ command: backendWorkerCommand(), env, entryPath });

const handlerOf = (definition: unknown, id: string) => {
  const command = (definition as { commands: Array<{ id: string; run: Record<string, string> }> }).commands.find(
    (entry) => entry.id === id,
  );
  return command!.run[HANDLER_MARKER]!;
};

test("a command runs in its own process and reaches only the host surface it was given", async () => {
  const worker = await start();
  try {
    const { context, logs } = hostContext();
    const bytes = new Uint8Array([1, 2, 3]);
    const result = (await worker.invoke({
      handlerId: handlerOf(worker.definition, "save"),
      context,
      surface,
      args: [{ id: "a", bytes }],
    })) as { project: string; stored: { bytes: Uint8Array }; pid: number };
    expect(result.project).toBe("p1");
    expect(result.stored.bytes).toEqual(bytes);
    expect(result.pid).not.toBe(process.pid);
    expect(logs).toEqual(["saved a"]);
    expect((worker.definition as { commands: Array<{ title: string }> }).commands[0]!.title).toBe("Save");

    expect(await worker.invoke({ handlerId: handlerOf(worker.definition, "forge"), context, surface, args: [] })).toBe(
      "backend_unavailable",
    );
  } finally {
    await worker.stop();
  }
});

test("the worker environment carries no host secrets", async () => {
  const hostEnv = { ...process.env, PSTDIO_API_TOKEN: "runtime-token", OPENAI_API_KEY: "provider-key" };
  const previousCwd = process.cwd();
  // Bun loads .env from a process's working directory; the worker must not start in the host's.
  await writeFile(join(root, ".env"), "SECRET_FROM_DOTENV=leaked\n");
  try {
    process.chdir(root);
    const worker = await start(createExtensionProcessEnvironment(hostEnv));
    try {
      const env = (await worker.invoke({
        handlerId: handlerOf(worker.definition, "environment"),
        context: {},
        surface: { kind: "object", members: {} },
        args: [],
      })) as Record<string, string>;
      expect(env.PSTDIO_API_TOKEN).toBeUndefined();
      expect(env.OPENAI_API_KEY).toBeUndefined();
      expect(env.SECRET_FROM_DOTENV).toBeUndefined();
      expect(env.PATH).toBe(process.env.PATH!);
    } finally {
      await worker.stop();
    }
  } finally {
    process.chdir(previousCwd);
  }
});

test("cancelling settles the caller and aborts the worker's signal", async () => {
  const worker = await start();
  try {
    const controller = new AbortController();
    const waiting = worker.invoke({
      handlerId: handlerOf(worker.definition, "wait"),
      context: {},
      surface,
      args: [],
      signal: controller.signal,
    });
    controller.abort(new Error("stop"));
    await expect(waiting).rejects.toThrow("stop");
    expect(
      await worker.invoke({
        handlerId: handlerOf(worker.definition, "observed-abort"),
        context: {},
        surface,
        args: [],
      }),
    ).toBe(true);
  } finally {
    await worker.stop();
  }
});

test("an abort during context value collection settles the invocation", async () => {
  const worker = await start();
  try {
    const controller = new AbortController();
    const waiting = worker.invoke({
      handlerId: handlerOf(worker.definition, "wait"),
      context: {
        get projectId() {
          controller.abort(new Error("stopped during context read"));
          return "p1";
        },
      },
      surface,
      args: [],
      signal: controller.signal,
    });
    // The worker can answer a separate command even when the waiting invocation never settles.
    const status = worker.invoke({
      handlerId: handlerOf(worker.definition, "observed-abort"),
      context: {},
      surface,
      args: [],
    });
    const outcome = await Promise.race([waiting.catch((error: Error) => error.message), status.then(() => "pending")]);
    expect(outcome).toBe("stopped during context read");
  } finally {
    await worker.stop();
  }
});

test("a worker invocation keeps its original host context when the caller reuses the input", async () => {
  const worker = await start();
  try {
    const given = hostContext();
    const next = hostContext();
    const invocation: BackendInvocation = {
      handlerId: handlerOf(worker.definition, "save"),
      context: given.context,
      surface,
      args: [{ id: "first" }],
    };
    const pending = worker.invoke(invocation);
    invocation.context = next.context;
    await pending;
    expect(given.logs).toEqual(["saved first"]);
    expect(next.logs).toEqual([]);
  } finally {
    await worker.stop();
  }
});

test("a crashed worker rejects its callers once and the next request starts a fresh one", async () => {
  const pool = createBackendWorkerPool(() => ({ env: createExtensionProcessEnvironment(), entryPath }));
  try {
    const first = await pool.acquire("source@1");
    const { context } = hostContext();
    const crash = first.invoke({ handlerId: handlerOf(first.definition, "crash"), context, surface, args: [] });
    await expect(crash).rejects.toBeInstanceOf(BackendUnavailableError);
    await first.exited;
    await expect(
      first.invoke({ handlerId: handlerOf(first.definition, "save"), context, surface, args: [{ id: "b" }] }),
    ).rejects.toBeInstanceOf(BackendUnavailableError);

    const second = await pool.acquire("source@1");
    expect(second).not.toBe(first);
    expect(
      await second.invoke({ handlerId: handlerOf(second.definition, "save"), context, surface, args: [{ id: "c" }] }),
    ).toMatchObject({ project: "p1" });
  } finally {
    await pool.close();
  }
});

test("hostile or broken workers settle their callers without host errors", async () => {
  const worker = await start();
  try {
    const { context } = hostContext();
    const failing = { ...context, logger: { info: () => Promise.reject(new Error("log sink down")) } };
    const failed = worker.invoke({
      handlerId: handlerOf(worker.definition, "log-and-fail"),
      context: failing,
      surface,
      args: [],
    });
    await expect(failed).rejects.toThrow("boom");
    await expect(failed).rejects.not.toMatchObject({ code: "backend_unavailable" });
    await expect(
      worker.invoke({
        handlerId: handlerOf(worker.definition, "save"),
        context,
        surface,
        args: [{ id: "a", run: () => {} }],
      }),
    ).rejects.toThrow();
    expect(
      await worker.invoke({ handlerId: handlerOf(worker.definition, "save"), context, surface, args: [{ id: "a" }] }),
    ).toMatchObject({ project: "p1" });
    const dropped = worker.invoke({
      handlerId: handlerOf(worker.definition, "disconnect"),
      context,
      surface,
      args: [],
    });
    await expect(dropped).rejects.toBeInstanceOf(BackendUnavailableError);
    await worker.exited;
  } finally {
    await worker.stop();
  }
});

test("retiring a generation stops its worker before a new one starts", async () => {
  const pool = createBackendWorkerPool(() => ({ env: createExtensionProcessEnvironment(), entryPath }));
  try {
    const old = await pool.acquire("source@1");
    expect(await pool.acquire("source@1")).toBe(old);
    await pool.retire("source@1");
    expect(await old.exited).not.toBeUndefined();
    expect(await pool.acquire("source@1")).not.toBe(old);
  } finally {
    await pool.close();
  }
});

test("a worker that cannot start leaves no working folder behind", async () => {
  const leftovers = async () => (await readdir(tmpdir())).filter((name) => name.startsWith("pstdio-backend-")).length;
  const before = await leftovers();
  await expect(
    startBackendWorker({
      command: [join(root, "missing-executable")],
      env: createExtensionProcessEnvironment(),
      entryPath,
    }),
  ).rejects.toThrow();
  expect(await leftovers()).toBe(before);
});

test("closing the pool refuses new workers and stops every running one", async () => {
  const pool = createBackendWorkerPool(() => ({ env: createExtensionProcessEnvironment(), entryPath }));
  const running = await pool.acquire("source@1");
  const closing = pool.close();
  await expect(pool.acquire("source@2")).rejects.toBeInstanceOf(BackendUnavailableError);
  await closing;
  expect(await running.exited).not.toBeUndefined();
  const reopened = await pool.acquire("source@1");
  expect(reopened).not.toBe(running);
  await pool.close();
});

test("concurrent closes both wait for the worker to exit", async () => {
  const pool = createBackendWorkerPool(() => ({ env: createExtensionProcessEnvironment(), entryPath }));
  try {
    const running = await pool.acquire("source@1");
    let exited = false;
    void running.exited.then(() => {
      exited = true;
    });
    const closing = pool.close();
    try {
      await pool.close();
      expect(exited).toBe(true);
    } finally {
      await closing;
    }
  } finally {
    await pool.close();
  }
});

test("closing waits for a retirement the pool did not start", async () => {
  const pool = createBackendWorkerPool(() => ({ env: createExtensionProcessEnvironment(), entryPath }));
  try {
    await pool.acquire("source@1");
    const retiring = pool.retire("source@1");
    const closing = pool.close();
    try {
      await expect(pool.acquire("source@2")).rejects.toBeInstanceOf(BackendUnavailableError);
    } finally {
      await Promise.all([retiring, closing]);
    }
  } finally {
    await pool.close();
  }
});

test("closing an empty pool allows subsequent workers to be started and closed", async () => {
  const pool = createBackendWorkerPool(() => ({ env: createExtensionProcessEnvironment(), entryPath }));
  await pool.close();
  const running = await pool.acquire("source@1");
  let exited = false;
  void running.exited.then(() => {
    exited = true;
  });
  try {
    await pool.close();
    expect(exited).toBe(true);
  } finally {
    await running.stop();
  }
});

test("host calls and notifications resume in the invocation's async scope", async () => {
  const worker = await start();
  const scope = new AsyncLocalStorage<string>();
  const seen: Array<string | undefined> = [];
  const capture = () => seen.push(scope.getStore());
  try {
    await scope.run("active invocation", () =>
      worker.invoke({
        handlerId: handlerOf(worker.definition, "save"),
        context: {
          projectId: "p1",
          logger: { info: capture },
          storage: { collection: () => ({ put: async () => capture(), get: async () => capture() }) },
        },
        surface,
        args: [{ id: "a", bytes: new Uint8Array([1]) }],
      }),
    );
  } finally {
    await worker.stop();
  }
  expect(seen).toEqual(["active invocation", "active invocation", "active invocation"]);
});

test("functions and iterables cross the boundary in both directions during an invocation", async () => {
  const worker = await start();
  try {
    const liveSurface: BackendSurface = {
      kind: "object",
      members: {
        live: {
          kind: "object",
          members: { apply: { kind: "async" }, open: { kind: "async" }, follow: { kind: "iterate" } },
        },
      },
    };
    const context = {
      live: {
        apply: async (fn: (value: number) => Promise<number>, value: number) => fn(value),
        open: async () => ({ close: async () => "closed by host" }),
        follow: async function* () {
          yield "first";
          yield "second";
        },
      },
    };
    expect(
      await worker.invoke({ handlerId: handlerOf(worker.definition, "live"), context, surface: liveSurface, args: [] }),
    ).toEqual({ doubled: 42, closed: "closed by host", entries: ["first", "second"] });
  } finally {
    await worker.stop();
  }
});

test("listener failures, host objects, abort signals and abandoned iterators stay contained", async () => {
  const worker = await start();
  const unhandled: unknown[] = [];
  const onUnhandled = (reason: unknown) => unhandled.push(reason);
  process.on("unhandledRejection", onUnhandled);
  let iteratorClosed = false;
  class Entity {
    name = "entity";
    #secret = "host secret";
    reveal() {
      return this.#secret;
    }
  }
  try {
    const edgeSurface: BackendSurface = {
      kind: "object",
      members: {
        live: {
          kind: "object",
          members: {
            listen: { kind: "async" },
            entity: { kind: "async" },
            wait: { kind: "async" },
            follow: { kind: "iterate" },
          },
        },
      },
    };
    const context = {
      live: {
        listen: async (listener: () => void) => {
          listener();
        },
        entity: async () => new Entity(),
        wait: ({ signal }: { signal: AbortSignal }) =>
          new Promise((resolve) => {
            if (signal.aborted) resolve("aborted");
            signal.addEventListener("abort", () => resolve("aborted"), { once: true });
          }),
        follow: async function* () {
          try {
            yield "first";
            await new Promise(() => {});
          } finally {
            iteratorClosed = true;
          }
        },
      },
    };
    expect(
      await worker.invoke({
        handlerId: handlerOf(worker.definition, "edges"),
        context,
        surface: edgeSurface,
        args: [],
      }),
    ).toEqual({ entityKeys: ["name"], hasMethod: "undefined", aborted: "aborted" });
    await Bun.sleep(50);
    expect(iteratorClosed).toBe(true);
    expect(unhandled).toEqual([]);
  } finally {
    process.off("unhandledRejection", onUnhandled);
    await worker.stop();
  }
});

test("Blob conversion preserves shared records and plain async iterables over worker IPC", async () => {
  const worker = await start();
  try {
    const context = {
      async inspect(value: { first: { blob: Blob }; second: { blob: Blob }; items: AsyncIterable<string> }) {
        return {
          sameRecord: value.first === value.second,
          first: value.first.blob instanceof Blob ? await value.first.blob.text() : undefined,
          second: value.second.blob instanceof Blob ? await value.second.blob.text() : undefined,
          items: await Array.fromAsync(value.items),
        };
      },
    };
    expect(
      await worker.invoke({
        handlerId: handlerOf(worker.definition, "shape"),
        context,
        surface: { kind: "object", members: { inspect: { kind: "async" } } },
        args: [],
      }),
    ).toEqual({ sameRecord: true, first: "asset bytes", second: "asset bytes", items: ["entry"] });
  } finally {
    await worker.stop();
  }
});

test("a normally completed long call gets a full idle window", async () => {
  const interval = setInterval(() => {}, 60_000);
  const schedule = spyOn(globalThis, "setInterval").mockReturnValue(interval);
  const pool = createBackendWorkerPool(() => ({ env: createExtensionProcessEnvironment(), entryPath }), {
    idleMs: 100,
  });
  try {
    const worker = await pool.acquire("source@1");
    const entered = Promise.withResolvers<void>();
    const finish = Promise.withResolvers<string>();
    const running = worker.invoke({
      handlerId: handlerOf(worker.definition, "finish"),
      context: {
        finish: () => {
          entered.resolve();
          return finish.promise;
        },
      },
      surface: { kind: "object", members: { finish: { kind: "async" } } },
      args: [],
    });
    await entered.promise;
    await Bun.sleep(125);
    finish.resolve("settled");
    expect(await running).toBe("settled");
    const [sweep] = schedule.mock.calls[0]!;
    if (typeof sweep !== "function") throw new Error("Expected to schedule the idle sweep");
    await sweep();
    await Promise.resolve();
    expect(await pool.acquire("source@1")).toBe(worker);
  } finally {
    schedule.mockRestore();
    clearInterval(interval);
    await pool.close();
  }
});

test("closing a reusable worker pool clears each owned idle timer", async () => {
  const schedule = spyOn(globalThis, "setInterval");
  const clear = spyOn(globalThis, "clearInterval");
  const pool = createBackendWorkerPool(() => ({ env: createExtensionProcessEnvironment(), entryPath }));
  try {
    await pool.acquire("source@1");
    const first = schedule.mock.results[0]?.value;
    expect(first).toBeDefined();
    await pool.close();
    expect(clear).toHaveBeenCalledWith(first);
    await pool.acquire("source@2");
    const second = schedule.mock.results[1]?.value;
    expect(second).toBeDefined();
    await pool.close();
    expect(clear).toHaveBeenCalledWith(second);
  } finally {
    await pool.close();
    for (const { value } of schedule.mock.results) clearInterval(value as ReturnType<typeof setInterval>);
    clear.mockRestore();
    schedule.mockRestore();
  }
});

test("an idle worker retires, and a running call keeps its worker alive", async () => {
  const pool = createBackendWorkerPool(() => ({ env: createExtensionProcessEnvironment(), entryPath }), {
    idleMs: 100,
  });
  try {
    const busy = await pool.acquire("source@1");
    const controller = new AbortController();
    const waiting = busy.invoke({
      handlerId: handlerOf(busy.definition, "wait"),
      context: {},
      surface,
      args: [],
      signal: controller.signal,
    });
    await Bun.sleep(400);
    expect(await pool.acquire("source@1")).toBe(busy);
    controller.abort(new Error("done"));
    await waiting.catch(() => {});
    await Bun.sleep(400);
    expect(await busy.exited).not.toBeUndefined();
    expect(await pool.acquire("source@1")).not.toBe(busy);
  } finally {
    await pool.close();
  }
});
