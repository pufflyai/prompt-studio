import { afterAll, beforeAll, expect, mock, spyOn, test } from "bun:test";
import { AsyncLocalStorage } from "node:async_hooks";
import { subscribe, unsubscribe } from "node:diagnostics_channel";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ProcessHandle } from "pstdio-api-contracts/extension-kernel";
import { runtimeOperationChannel } from "pstdio-diagnostics";
import { expectRejection } from "../../test-utils/expect-rejection";
import { createBackendWorkerEnvironment, createExtensionProcessEnvironment } from "../process-environment";
import { createProcessHandleProxy, createProcessOwner, failedProcessHandle, processError } from "../process-owner";
import { markHostContext } from "../runner/host-context";
import { extensionContextSurface } from "./context-surface";
import { HOST_CALL_LIMITS } from "./host-calls";
import { backendWorkerCommand, createBackendWorkerPool } from "./pool";
import { HANDLER_MARKER } from "./protocol";
import { snapshotSink } from "./remote-values";
import { serviceSurfaces } from "./service-surfaces";
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
let waiting = false;
class ProviderChild {
  id = "provider-child";
  started = Promise.resolve();
  outcome = Promise.withResolvers();
  exited = this.outcome.promise;
  input = [];
  async write(data) { this.input.push(data); }
  async end() { this.outcome.resolve({ code: 0, signal: null }); }
  async kill(signal) { this.outcome.resolve({ code: null, signal }); }
  async *events() {
    for (const data of this.input) yield { type: "stdout", data };
    yield { type: "exit", exit: await this.exited };
  }
}
class FinishedProviderLeader {
  id = "provider-leader";
  started = Promise.resolve();
  exited = Promise.resolve({ code: 0, signal: null });
  stops = 0;
  async write() {}
  async end() {}
  async kill() { this.stops++; }
  async *events() { yield { type: "stdout", data: new Uint8Array([this.stops]) }; }
}
export default {
  workspaceTypes: [
    { spawn: () => new ProviderChild() },
    { spawn: () => {
      const child = new ProviderChild();
      return { ...child, write: child.write, end: child.end, kill: child.kill, events: child.events };
    } },
    { spawn: (_ctx, confirmed) => {
      const child = new FinishedProviderLeader();
      if (confirmed) child.treeExited = Promise.resolve();
      return child;
    } },
  ],
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
      run: (ctx) => new Promise((resolve) => {
        waiting = true;
        ctx.signal.addEventListener("abort", () => {
          observedAbort = true;
          resolve("aborted");
        });
      }),
    },
    {
      id: "stray-rejection",
      title: "Stray rejection",
      run: () => {
        Promise.reject(new Error("nobody handles this"));
        return new Promise((resolve) => setTimeout(() => resolve(process.pid), 50));
      },
    },
    { id: "waiting", title: "Waiting", run: () => waiting },
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
      id: "endless",
      title: "Endless",
      run: () => {
        while (true);
      },
    },
    {
      id: "hog",
      title: "Hog",
      run: async () => {
        globalThis.hog = Array.from({ length: 256 }, () => new Uint8Array(1024 * 1024).fill(1));
        await new Promise(() => {});
      },
    },
    {
      id: "harness-start",
      title: "Harness start",
      async start(ctx, input) {
        input.events.push({ op: "add", path: "/messages/1", value: { id: "m1", role: "user", parts: [] } });
        input.events.push({ op: "add", path: "/messages/2", value: { id: "m2", role: "assistant", parts: [] } });
        const seen = input.events.getMessages().map((message) => message.id);
        const approval = await input.approvals.requestApproval({ id: "a1", tool: "shell" });
        let finish;
        const done = new Promise((resolve) => (finish = resolve));
        return { done, seen, approval, stop: () => finish({ status: "stopped" }) };
      },
    },
    {
      id: "harness-late",
      title: "Harness late",
      async start(ctx, input) {
        let finish;
        const done = new Promise((resolve) => (finish = resolve));
        setTimeout(async () => {
          input.events.push({ op: "add", path: "/messages/0", value: { id: "late", role: "assistant", parts: [] } });
          finish(await input.approvals.requestApproval({ id: "a2", tool: "shell" }));
        }, 100);
        return { done };
      },
    },
    {
      id: "prepared-operation",
      run: () => ({ invoke(input) { return input.events.getMessages().map((message) => message.id); } }),
    },
    {
      id: "harness-host-stream",
      async start(ctx) {
        const stream = ctx.connections.stream("example")[Symbol.asyncIterator]();
        const first = await stream.next();
        return { first, next: () => stream.next(), stop: () => stream.return() };
      },
    },
    {
      id: "prepared-question",
      run: () => ({
        invoke(input) {
          const done = input.questions.ask().then((answers) => {
            input.events.push({ op: "add", path: "/messages/0", value: { id: "answered", role: "assistant", parts: [] } });
            return answers;
          });
          return { done };
        },
      }),
    },
    {
      id: "short-lived-scope",
      async run(ctx, input) {
        let after;
        await ctx.scope.run(() => {
          after = input.wait().then(() => ctx.scope.read().catch((error) => error.message));
        });
        await input.scopedCallbackFinished();
        return await after;
      },
    },
    {
      id: "drain-cancel",
      async run(ctx, marker) {
        const handle = await ctx.live.open();
        const stopped = new Promise((resolve) => ctx.signal.addEventListener("abort", resolve, { once: true }));
        ctx.live.ready();
        try {
          await stopped;
        } finally {
          await handle.close();
        }
        return {
          [Symbol.asyncIterator]() {
            return {
              next: async () => ({ done: false, value: 42 }),
              return: async () => {
                await Bun.write(marker, "closed");
                return { done: true };
              },
            };
          },
        };
      },
    },
    {
      id: "ignore-cancel",
      async run(ctx) {
        ctx.live.ready();
        await new Promise(() => {});
      },
    },
    {
      id: "orphan",
      title: "Orphan",
      run: () => {
        const detached = process.platform === "win32";
        const child = Bun.spawn([process.execPath, "-e", "setInterval(() => {}, 1000)"], {
          stdio: ["ignore", "ignore", "ignore"],
          detached,
          windowsHide: true,
        });
        // Keep Bun's own Windows subprocess cleanup from masking the supervisor's job.
        if (detached) child.unref();
        return child.pid;
      },
    },
    {
      id: "flood",
      title: "Flood",
      async run(ctx, kind, count, refusals = 0) {
        const handle = kind === "terminal" ? ctx.terminal.openSession({ cols: 80, rows: 24 }) : ctx.open();
        if (kind === "terminal") {
          const stream = handle.events()[Symbol.asyncIterator]();
          await stream.next();
          await stream.return();
        } else await handle.started;
        const calls = Array.from({ length: count }, () => ctx.storage.collection("items").get("never"));
        // Release the held calls only once the expected refusals arrived, whatever the runner's speed.
        let refused = 0;
        if (refusals)
          await new Promise((resolve) =>
            calls.forEach((call) => call.catch(() => ++refused === refusals && resolve())),
          );
        const cleanup = await handle.kill().then(() => "killed", (error) => error.code);
        ctx.release?.();
        const results = await Promise.allSettled(calls);
        const refusedCodes = results.filter((result) => result.status === "rejected").map((result) => result.reason.code);
        return { refusedCodes, cleanup };
      },
    },
    { id: "mark", title: "Mark", run: (ctx, path) => Bun.write(path, "ran") },
    {
      id: "session",
      title: "Session",
      run(ctx) {
        let finish;
        const done = new Promise((resolve) => (finish = resolve));
        return {
          done,
          read: () => ctx.storage.collection("items").get("a"),
          stop: () => finish("stopped"),
        };
      },
    },
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
    {
      id: "pty-open",
      title: "Open terminal",
      run(ctx) {
        const session = ctx.terminal.openSession({ cols: 80, rows: 24 });
        session.write("a");
        session.resize(100, 30);
        session.write("b");
        globalThis.pty = session;
        return typeof session.id;
      },
    },
    {
      id: "pty-read",
      title: "Read terminal",
      async run() {
        const session = globalThis.pty;
        const iterator = session.events()[Symbol.asyncIterator]();
        let second;
        try {
          session.events();
        } catch (error) {
          second = error.message;
        }
        const first = (await iterator.next()).value;
        await session.kill();
        const last = (await iterator.next()).value;
        return { first, last, second };
      },
    },
    {
      id: "pty-peek",
      title: "Peek terminal",
      async run() {
        await globalThis.pty.events()[Symbol.asyncIterator]().next();
        // The handle stays; only its events iterator becomes unreachable.
        for (let attempt = 0; attempt < 3; attempt++) {
          Bun.gc(true);
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
      },
    },
    {
      id: "pty-drop",
      title: "Drop terminal",
      async run() {
        globalThis.pty = undefined;
        for (let attempt = 0; attempt < 3; attempt++) {
          Bun.gc(true);
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
      },
    },
    {
      id: "pty-fail",
      title: "Failed terminal",
      async run(ctx) {
        const session = ctx.terminal.openSession({ cols: 1, rows: 1, fail: true });
        session.write("x");
        try {
          for await (const event of session.events());
        } catch (error) {
          return error.message;
        }
      },
    },
    {
      id: "spawn-stream",
      title: "Spawn and stream",
      async run(ctx) {
        const handle = ctx.process.spawn({ command: ["agent"] });
        const id = handle.id;
        // The host never accepts this write; the kill after it must not wait for it.
        const stuck = handle.write("stuck").then(() => "written", (error) => error.message);
        await handle.started;
        await handle.write("hello");
        await handle.end();
        const iterator = handle.events()[Symbol.asyncIterator]();
        const first = (await iterator.next()).value;
        await handle.kill();
        const treeExitReported = handle.treeExited instanceof Promise;
        await handle.treeExited;
        const rest = [];
        for (let next = await iterator.next(); !next.done; next = await iterator.next()) rest.push(next.value);
        return {
          id: typeof id,
          first: { type: first.type, text: new TextDecoder().decode(first.data) },
          rest,
          exited: await handle.exited,
          treeExitReported,
          pending: await Promise.race([stuck, new Promise((resolve) => setTimeout(() => resolve("still waiting"), 50))]),
        };
      },
    },
    {
      id: "spawn-fail",
      title: "Failed spawn",
      async run(ctx) {
        const handle = ctx.process.spawn({ command: ["agent"], fail: true });
        const code = await handle.started.then(() => "started", (error) => error.code);
        return { code, exited: await handle.exited };
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
  await expectRejection(
    startBackendWorker({
      command: backendWorkerCommand(),
      env: createExtensionProcessEnvironment(),
      entryPath: mapEntry,
    }),
  ).toThrow("default.commands[0].options cannot be sent");
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

test("the worker environment is the host's without the names Prompt Studio reserves", async () => {
  const names = {
    PSTDIO_API_TOKEN: "runtime-token",
    NPM_CONFIG_REGISTRY: "https://registry.example",
    NPM_TOKEN: "registry-token",
    NODE_AUTH_TOKEN: "registry-token",
    BUN_BE_BUN: "1",
    OPENAI_API_KEY: "provider-key",
    PSTDIO_AUTOMATION_TOKEN: "automation-token",
    PSTDIO_TEST_MODE: "1",
  };
  const previous = Object.fromEntries(Object.keys(names).map((name) => [name, process.env[name]]));
  const previousCwd = process.cwd();
  try {
    Object.assign(process.env, names);
    // Bun loads .env from a process's working directory; the worker must not start in the host's.
    await writeFile(join(root, ".env"), "SECRET_FROM_DOTENV=leaked\n");
    process.chdir(root);
    const worker = await start(createBackendWorkerEnvironment());
    try {
      const env = (await worker.invoke({
        handlerId: handlerOf(worker.definition, "environment"),
        context: {},
        surface: { kind: "object", members: {} },
        args: [],
      })) as Record<string, string>;
      for (const name of [
        "PSTDIO_API_TOKEN",
        "PSTDIO_AUTOMATION_TOKEN",
        "NPM_CONFIG_REGISTRY",
        "NPM_TOKEN",
        "NODE_AUTH_TOKEN",
        "BUN_BE_BUN",
      ])
        expect(env[name]).toBeUndefined();
      // Prompt Studio settings that are not credentials, such as its home and test mode, stay.
      expect(env.PSTDIO_TEST_MODE).toBe("1");
      expect(env.SECRET_FROM_DOTENV).toBeUndefined();
      expect(env.OPENAI_API_KEY).toBe("provider-key");
      // Windows names it Path; its environment lookups ignore case.
      const pathName = Object.keys(env).find((name) => name.toUpperCase() === "PATH");
      expect(pathName && env[pathName]).toBe(process.env.PATH!);
    } finally {
      await worker.stop();
    }
  } finally {
    process.chdir(previousCwd);
    for (const [name, value] of Object.entries(previous))
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
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
    // A call cancelled before it reaches the worker is never sent, so cancel once the handler runs.
    const invokeWaiting = () =>
      worker.invoke({ handlerId: handlerOf(worker.definition, "waiting"), context: {}, surface, args: [] });
    while (!(await invokeWaiting())) await Bun.sleep(5);
    controller.abort(new Error("stop"));
    await expectRejection(waiting).toThrow("stop");
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
    // Stopping the worker below rejects the status call if it has not been answered yet.
    const answered = status.then(
      () => "pending",
      () => "pending",
    );
    const outcome = await Promise.race([waiting.catch((error: Error) => error.message), answered]);
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
    await expectRejection(crash).toBeInstanceOf(BackendUnavailableError);
    await first.exited;
    await expectRejection(
      first.invoke({ handlerId: handlerOf(first.definition, "save"), context, surface, args: [{ id: "b" }] }),
    ).toBeInstanceOf(BackendUnavailableError);

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
    // Bun's async toThrow can stall a pending child process response on Windows (ADR 0136).
    const error = await failed.then(
      () => undefined,
      (reason: unknown) => reason,
    );
    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({ message: "boom" });
    expect(error).not.toMatchObject({ code: "backend_unavailable" });
    await expectRejection(
      worker.invoke({
        handlerId: handlerOf(worker.definition, "save"),
        context,
        surface,
        args: [{ id: "a", tag: Symbol("not sendable") }],
      }),
    ).toThrow();
    expect(
      await worker.invoke({ handlerId: handlerOf(worker.definition, "save"), context, surface, args: [{ id: "a" }] }),
    ).toMatchObject({ project: "p1" });
    const dropped = worker.invoke({
      handlerId: handlerOf(worker.definition, "disconnect"),
      context,
      surface,
      args: [],
    });
    await expectRejection(dropped).toBeInstanceOf(BackendUnavailableError);
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
  await expectRejection(
    startBackendWorker({
      command: [join(root, "missing-executable")],
      env: createExtensionProcessEnvironment(),
      entryPath,
    }),
  ).toThrow();
  expect(await leftovers()).toBe(before);
});

test("closing the pool refuses new workers and stops every running one", async () => {
  const pool = createBackendWorkerPool(() => ({ env: createExtensionProcessEnvironment(), entryPath }));
  const running = await pool.acquire("source@1");
  const closing = pool.close();
  await expectRejection(pool.acquire("source@2")).toBeInstanceOf(BackendUnavailableError);
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
      await expectRejection(pool.acquire("source@2")).toBeInstanceOf(BackendUnavailableError);
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

test("a returned session handle keeps working after its handler returns, until the host drops it", async () => {
  const worker = await start();
  try {
    const { context } = hostContext();
    await context.storage.collection("items").put("a", { text: "kept" });
    type Session = { done: Promise<unknown>; read(): Promise<unknown>; stop(): Promise<unknown> };
    // A separate frame, so no stack slot of this test keeps the session reachable afterwards.
    const runSession = async () => {
      const session = (await worker.invoke({
        handlerId: handlerOf(worker.definition, "session"),
        context,
        surface,
        args: [],
      })) as Session;
      expect(worker.busy).toBe(true);
      expect(await session.read()).toEqual({ text: "kept" });
      await session.stop();
      expect(await session.done).toBe("stopped");
    };
    await runSession();
    for (let attempt = 0; worker.busy && attempt < 50; attempt++) {
      Bun.gc(true);
      await Bun.sleep(20);
    }
    expect(worker.busy).toBe(false);
  } finally {
    await worker.stop();
  }
});

test("a harness start keeps getMessages synchronous and forwards event patches in order", async () => {
  const worker = await start();
  try {
    const pushed: unknown[] = [];
    const messages: { id: string }[] = [{ id: "m0" }];
    const input = {
      prompt: "hi",
      events: {
        push: (patch: { value: { id: string } }) => {
          pushed.push(patch.value.id);
          messages.push(patch.value);
        },
        getMessages: () => [...messages],
      },
      approvals: { requestApproval: async () => ({ decision: "approved" }) },
    };
    const handlerId = (
      worker.definition as { commands: Array<{ id: string; start?: Record<string, string> }> }
    ).commands.find((entry) => entry.id === "harness-start")!.start![HANDLER_MARKER]!;
    const context = markHostContext({ projectId: "p1", extensionId: "example.harness" });
    const session = (await worker.invoke({
      handlerId,
      context,
      surface,
      args: [{ ...input, events: snapshotSink(input.events as never) }],
    })) as { seen: string[]; approval: unknown; done: Promise<unknown>; stop(): Promise<void> };
    expect(session.seen).toEqual(["m0", "m1", "m2"]);
    expect(session.approval).toEqual({ decision: "approved" });
    for (let attempt = 0; pushed.length < 2 && attempt < 50; attempt++) await Bun.sleep(10);
    expect(pushed).toEqual(["m1", "m2"]);
    await session.stop();
    expect(await session.done).toEqual({ status: "stopped" });
  } finally {
    await worker.stop();
  }
});

test("a harness keeps its event sink and approvals after start returns", async () => {
  const worker = await start();
  try {
    const pushed: string[] = [];
    const input = {
      events: snapshotSink({
        push: (patch: { value: { id: string } }) => void pushed.push(patch.value.id),
        getMessages: () => [],
      } as never),
      approvals: { requestApproval: async () => ({ decision: "approved" }) },
    };
    const handlerId = (
      worker.definition as { commands: Array<{ id: string; start?: Record<string, string> }> }
    ).commands.find((entry) => entry.id === "harness-late")!.start![HANDLER_MARKER]!;
    const context = markHostContext({ projectId: "p1", extensionId: "example.harness" });
    const session = (await worker.invoke({ handlerId, context, surface, args: [input] })) as { done: Promise<unknown> };
    expect(await session.done).toEqual({ decision: "approved" });
    expect(pushed).toEqual(["late"]);
  } finally {
    await worker.stop();
  }
});

test("a live harness continues reading and closes a host stream it opened during start", async () => {
  const worker = await start();
  try {
    const closed = Promise.withResolvers<void>();
    const handlerId = (
      worker.definition as { commands: Array<{ id: string; start?: Record<string, string> }> }
    ).commands.find((entry) => entry.id === "harness-host-stream")!.start![HANDLER_MARKER]!;
    const session = (await worker.invoke({
      handlerId,
      context: {
        connections: {
          async *stream() {
            try {
              yield "first";
              yield "second";
            } finally {
              closed.resolve();
            }
          },
        },
      },
      surface: {
        kind: "object",
        members: { connections: { kind: "object", members: { stream: { kind: "iterate", signalArg: 1 } } } },
      },
      args: [],
    })) as { first: IteratorResult<string>; next(): Promise<IteratorResult<string>>; stop(): Promise<unknown> };
    expect(session.first).toEqual({ done: false, value: "first" });
    expect(await session.next()).toEqual({ done: false, value: "second" });
    await session.stop();
    await closed.promise;
  } finally {
    await worker.stop();
  }
});

test("a call cancelled while its arguments are prepared never reaches the worker", async () => {
  const worker = await start();
  try {
    const marker = join(root, "cancelled-mark");
    const controller = new AbortController();
    const running = worker.invoke({
      handlerId: handlerOf(worker.definition, "mark"),
      context: {},
      surface,
      args: [marker],
      signal: controller.signal,
    });
    controller.abort(new Error("cancelled"));
    await expectRejection(running).toThrow("cancelled");
    await Bun.sleep(200);
    expect(await Bun.file(marker).exists()).toBe(false);
    expect(worker.busy).toBe(false);
  } finally {
    await worker.stop();
  }
});

test("an endless loop or a memory hog is stopped from outside the worker", async () => {
  const watched = (watchdog: Parameters<typeof startBackendWorker>[0]["watchdog"]) =>
    startBackendWorker({
      command: backendWorkerCommand(),
      env: createExtensionProcessEnvironment(),
      entryPath,
      watchdog,
    });
  const verify = async (handler: string, options: Parameters<typeof watched>[0], expected: string) => {
    const worker = await watched(options);
    const expiry = Promise.withResolvers<never>();
    const timer = setTimeout(() => expiry.reject(new Error(`Watchdog fixture did not stop ${handler}`)), 4_000);
    try {
      const invoke = worker.invoke({
        handlerId: handlerOf(worker.definition, handler),
        context: {},
        surface,
        args: [],
      });
      await expectRejection(Promise.race([invoke, expiry.promise])).toThrow(expected);
      await Promise.race([worker.exited, expiry.promise]);
    } finally {
      clearTimeout(timer);
      await worker.stop();
    }
  };
  await verify("endless", { heartbeatMs: 50, unresponsiveMs: 500 }, "did not respond");
  // Well above an idle worker on every runner (about 55 MiB on Linux), well below the 256 MiB hog.
  await verify("hog", { heartbeatMs: 50, memoryLimitBytes: 160 * 1024 * 1024 }, "memory limit");
}, 10_000);

test("a worker that keeps failing waits out a cooldown instead of restarting in a loop", async () => {
  const pool = createBackendWorkerPool(() => ({ env: createExtensionProcessEnvironment(), entryPath }), {
    restartBudget: { failures: 2, windowMs: 60_000, cooldownMs: 60_000 },
  });
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const worker = await pool.acquire("crashy@1");
      await worker
        .invoke({ handlerId: handlerOf(worker.definition, "crash"), context: {}, surface, args: [] })
        .catch(() => {});
      await worker.exited;
    }
    await expectRejection(pool.acquire("crashy@1")).toThrow("can start again");
  } finally {
    await pool.close();
  }
});

test("a synchronously opened terminal session runs its calls in order and outlives the call that opened it", async () => {
  const worker = await start();
  const unhandled: unknown[] = [];
  const onUnhandled = (reason: unknown) => unhandled.push(reason);
  process.on("unhandledRejection", onUnhandled);
  try {
    const calls: string[] = [];
    const exited = Promise.withResolvers<void>();
    const context = {
      terminal: {
        openSession: (request: { fail?: boolean }) => {
          if (request.fail) throw new Error("no shell");
          return {
            id: "host-id",
            write: (data: string) => void calls.push(data),
            resize: (cols: number, rows: number) => void calls.push(`${cols}x${rows}`),
            kill: async () => exited.resolve(),
            events: async function* () {
              yield { kind: "data", text: calls.join(",") };
              await exited.promise;
              yield { kind: "exit", code: 0 };
            },
          };
        },
      },
    };
    const terminalSurface: BackendSurface = {
      kind: "object",
      members: {
        terminal: {
          kind: "object",
          members: {
            openSession: {
              kind: "handle",
              members: { id: "id", write: "notify", resize: "notify", kill: "async", events: "iterate" },
            },
          },
        },
      },
    };
    const run = (id: string) =>
      worker.invoke({ handlerId: handlerOf(worker.definition, id), context, surface: terminalSurface, args: [] });
    expect(await run("pty-open")).toBe("string");
    expect(await run("pty-read")).toEqual({
      first: { kind: "data", text: "a,100x30,b" },
      last: { kind: "exit", code: 0 },
      second: "events() has one consumer per handle.",
    });
    expect(await run("pty-fail")).toBe("no shell");
    expect(worker.busy).toBe(true);
    await run("pty-drop");
    for (let attempt = 0; worker.busy && attempt < 50; attempt++) {
      Bun.gc(true);
      await Bun.sleep(20);
    }
    expect(worker.busy).toBe(false);
    expect(unhandled).toEqual([]);
  } finally {
    process.off("unhandledRejection", onUnhandled);
    await worker.stop();
  }
});

test("an events iterator the worker drops without return() closes the host's stream", async () => {
  const worker = await start();
  try {
    let closed = false;
    const context = {
      terminal: {
        openSession: () => ({
          id: "host-id",
          write: () => {},
          resize: () => {},
          kill: async () => {},
          events: async function* () {
            try {
              yield { kind: "data", text: "first" };
              await new Promise(() => {});
            } finally {
              closed = true;
            }
          },
        }),
      },
    };
    const terminalSurface: BackendSurface = {
      kind: "object",
      members: {
        terminal: {
          kind: "object",
          members: {
            openSession: {
              kind: "handle",
              members: { id: "id", write: "notify", resize: "notify", kill: "async", events: "iterate" },
            },
          },
        },
      },
    };
    const run = (id: string) =>
      worker.invoke({ handlerId: handlerOf(worker.definition, id), context, surface: terminalSurface, args: [] });
    await run("pty-open");
    await run("pty-peek");
    for (let attempt = 0; !closed && attempt < 50; attempt++) {
      Bun.gc(true);
      await Bun.sleep(20);
    }
    expect(closed).toBe(true);
    expect(worker.busy).toBe(true);
    await run("pty-drop");
  } finally {
    await worker.stop();
  }
});

test("a prepared harness operation receives a synchronous event sink", async () => {
  const worker = await start();
  try {
    const operation = (await worker.invoke({
      handlerId: handlerOf(worker.definition, "prepared-operation"),
      context: {},
      surface,
      args: [],
    })) as { invoke(input: { events: { getMessages(): { id: string }[]; push(): void } }): Promise<unknown> };
    expect(await operation.invoke({ events: { getMessages: () => [{ id: "m1" }], push: () => {} } })).toEqual(["m1"]);
  } finally {
    await worker.stop();
  }
});

test.each<[string, string[][]]>([
  ["answer", [["Blue"]]],
  ["skip", []],
])("a prepared harness session publishes a question %s after invoke returns", async (_kind, answers) => {
  const worker = await start();
  const answer = Promise.withResolvers<string[][]>();
  const pushed = spyOn({ push: (_patch: unknown) => {} }, "push");
  try {
    const operation = (await worker.invoke({
      handlerId: handlerOf(worker.definition, "prepared-question"),
      context: {},
      surface,
      args: [],
    })) as {
      invoke(input: {
        events: { getMessages(): unknown[]; push(patch: unknown): void };
        questions: { ask(): Promise<string[][]> };
      }): Promise<{ done: Promise<string[][]> }>;
    };
    const ask = spyOn({ ask: () => answer.promise }, "ask");
    const session = await operation.invoke({ events: { getMessages: () => [], push: pushed }, questions: { ask } });
    expect(ask).toHaveBeenCalledTimes(1);
    answer.resolve(answers);
    expect(await session.done).toEqual(answers);
    for (let attempt = 0; !pushed.mock.calls.length && attempt < 50; attempt++) await Bun.sleep(10);
    expect(pushed.mock.calls).toEqual([
      [{ op: "add", path: "/messages/0", value: { id: "answered", role: "assistant", parts: [] } }],
    ]);
  } finally {
    await worker.stop();
  }
});

test("work from a scoped callback still ends when that callback returns", async () => {
  const worker = await start();
  const wait = Promise.withResolvers<void>();
  const finished = Promise.withResolvers<void>();
  const read = mock(() => "scope");
  try {
    const result = worker.invoke({
      handlerId: handlerOf(worker.definition, "short-lived-scope"),
      context: { scope: { run: (callback: () => Promise<unknown>) => callback(), read } },
      surface: {
        kind: "object",
        members: { scope: { kind: "object", members: { run: { kind: "async" }, read: { kind: "async" } } } },
      },
      args: [{ wait: () => wait.promise, scopedCallbackFinished: () => finished.resolve() }],
    });
    await finished.promise;
    wait.resolve();
    expect(await result).toBe("The invocation's callback has finished.");
    expect(read).not.toHaveBeenCalled();
  } finally {
    await worker.stop();
  }
});

test("abort settles while an asynchronous Blob export is still pending", async () => {
  const worker = await start();
  const read = Promise.withResolvers<ArrayBuffer>();
  const started = Promise.withResolvers<void>();
  class PendingBlob extends Blob {
    override arrayBuffer() {
      started.resolve();
      return read.promise;
    }
  }
  const unhandled: unknown[] = [];
  const onUnhandled = (reason: unknown) => unhandled.push(reason);
  process.on("unhandledRejection", onUnhandled);
  try {
    const controller = new AbortController();
    const reason = new Error("Blob export cancelled");
    const marker = join(root, "aborted-blob-export");
    const invocation = worker
      .invoke({
        handlerId: handlerOf(worker.definition, "mark"),
        context: {},
        surface,
        args: [marker, new PendingBlob()],
        signal: controller.signal,
      })
      .catch((error) => error);
    await started.promise;
    controller.abort(reason);
    expect(await Promise.race([invocation, Bun.sleep(100).then(() => "still exporting")])).toBe(reason);
    read.reject(new Error("Blob read failed"));
    await Bun.sleep(30);
    expect(unhandled).toEqual([]);
    expect(await Bun.file(marker).exists()).toBe(false);
    expect(worker.busy).toBe(false);
  } finally {
    read.resolve(new ArrayBuffer(0));
    process.off("unhandledRejection", onUnhandled);
    await worker.stop();
  }
});

const drainSurface: BackendSurface = {
  kind: "object",
  members: {
    signal: { kind: "signal" },
    live: { kind: "object", members: { ready: { kind: "notify" }, open: { kind: "async" } } },
  },
};

test("cancelled handlers can close host handles and release the result they raced to return", async () => {
  const worker = await start();
  const marker = join(root, "drained-iterator");
  try {
    const ready = Promise.withResolvers<void>();
    const closed = Promise.withResolvers<void>();
    const controller = new AbortController();
    const reason = new Error("Cancel and drain");
    const handlerId = (id: string) => handlerOf(worker.definition, id);
    const invocation = worker
      .invoke({
        handlerId: handlerId("drain-cancel"),
        context: { live: { ready: () => ready.resolve(), open: () => ({ close: () => closed.resolve() }) } },
        surface: drainSurface,
        signal: controller.signal,
        args: [marker],
      })
      .catch((error) => error);
    await ready.promise;
    controller.abort(reason);
    expect(await invocation).toBe(reason);
    expect(await Promise.race([closed.promise.then(() => true), Bun.sleep(500).then(() => false)])).toBe(true);
    for (let attempt = 0; attempt < 50 && !(await Bun.file(marker).exists()); attempt++) await Bun.sleep(10);
    expect(await Bun.file(marker).text()).toBe("closed");
    expect(worker.busy).toBe(false);
  } finally {
    await worker.stop();
  }
});

test("a worker that ignores cancellation keeps its invocation only until the cleanup deadline", async () => {
  const worker = await startBackendWorker({
    command: backendWorkerCommand(),
    env: createExtensionProcessEnvironment(),
    entryPath,
    drainDeadlineMs: 300,
  });
  try {
    const ready = Promise.withResolvers<void>();
    const controller = new AbortController();
    const reason = new Error("Bounded drain");
    const invocation = worker
      .invoke({
        handlerId: handlerOf(worker.definition, "ignore-cancel"),
        context: { live: { ready: () => ready.resolve() } },
        surface: drainSurface,
        signal: controller.signal,
        args: [],
      })
      .catch((error) => error);
    await ready.promise;
    controller.abort(reason);
    expect(await invocation).toBe(reason);
    await Bun.sleep(30);
    expect(worker.busy).toBe(true);
    for (let attempt = 0; attempt < 50 && worker.busy; attempt++) await Bun.sleep(10);
    expect(worker.busy).toBe(false);
  } finally {
    await worker.stop();
  }
});

const isAlive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
const stopsWithin = async (pid: number) => {
  for (let attempt = 0; isAlive(pid) && attempt < 100; attempt++) await Bun.sleep(20);
  return !isAlive(pid);
};

test("processes extension code starts stop with its worker", async () => {
  const stopped = await start();
  const left = (await stopped.invoke({
    handlerId: handlerOf(stopped.definition, "orphan"),
    context: {},
    surface,
    args: [],
  })) as number;
  await stopped.stop();
  expect(await stopsWithin(left)).toBe(true);
});

test("processes extension code starts stop when its worker crashes", async () => {
  const crashing = await start();
  let orphan: number | undefined;
  try {
    orphan = (await crashing.invoke({
      handlerId: handlerOf(crashing.definition, "orphan"),
      context: {},
      surface,
      args: [],
    })) as number;
    expect(isAlive(orphan)).toBe(true);
    await expectRejection(
      crashing.invoke({ handlerId: handlerOf(crashing.definition, "crash"), context: {}, surface, args: [] }),
    ).toBeInstanceOf(BackendUnavailableError);
    expect(await crashing.exited).toBe(7);
    expect(await stopsWithin(orphan)).toBe(true);
  } finally {
    try {
      await crashing.stop();
    } finally {
      if (orphan && isAlive(orphan)) process.kill(orphan, "SIGKILL");
    }
  }
});

test("a worker stopped before its first heartbeat records its resident memory", async () => {
  const records: Array<Record<string, unknown>> = [];
  const listener = (message: unknown) => records.push(message as Record<string, unknown>);
  subscribe(runtimeOperationChannel, listener);
  try {
    const worker = await startBackendWorker({
      command: backendWorkerCommand(),
      env: createExtensionProcessEnvironment(),
      entryPath,
    });
    await worker.stop();
    const life = records.find((record) => record.kind === "extension.backend.worker");
    expect(life?.lastRssBytes).toBeGreaterThan(0);
    expect(life?.peakRssBytes).toBeGreaterThan(0);
    expect(life).toHaveProperty("exitCode");
  } finally {
    unsubscribe(runtimeOperationChannel, listener);
  }
});

test("a spawned process handle opens at once, forwards its members and settles its promises", async () => {
  const worker = await start();
  const unhandled: unknown[] = [];
  const onUnhandled = (reason: unknown) => unhandled.push(reason);
  process.on("unhandledRejection", onUnhandled);
  try {
    const writes: string[] = [];
    const exited = Promise.withResolvers<{ code: number | null; signal: string | null }>();
    const context = {
      process: {
        spawn: (input: { fail?: boolean }) => {
          if (input.fail) return failedProcessHandle(processError("process_target_unsupported", "no remote spawn"));
          return {
            id: "host-id",
            started: Promise.resolve(),
            exited: exited.promise,
            treeExited: exited.promise.then(() => {}),
            write: (data: string) => {
              writes.push(data);
              return data === "stuck" ? new Promise(() => {}) : Promise.resolve();
            },
            end: async () => void writes.push("<end>"),
            kill: async () => exited.resolve({ code: null, signal: "SIGTERM" }),
            events: async function* () {
              yield { type: "stdout", data: new TextEncoder().encode("out") };
              yield { type: "exit", exit: await exited.promise };
            },
          };
        },
      },
    };
    const processSurface: BackendSurface = { kind: "object", members: { process: serviceSurfaces.process! } };
    const run = (id: string) =>
      worker.invoke({ handlerId: handlerOf(worker.definition, id), context, surface: processSurface, args: [] });
    expect(await run("spawn-stream")).toEqual({
      id: "string",
      first: { type: "stdout", text: "out" },
      rest: [{ type: "exit", exit: { code: null, signal: "SIGTERM" } }],
      exited: { code: null, signal: "SIGTERM" },
      treeExitReported: true,
      pending: "still waiting",
    });
    expect(writes).toEqual(["stuck", "hello", "<end>"]);
    expect(await run("spawn-fail")).toEqual({
      code: "process_target_unsupported",
      exited: { code: null, signal: null },
    });
    await Bun.sleep(20);
    expect(unhandled).toEqual([]);
  } finally {
    process.off("unhandledRejection", onUnhandled);
    await worker.stop();
  }
});

test("worker workspace providers can return class and object process handles with bound methods", async () => {
  const worker = await start();
  try {
    const workspaceTypes = (worker.definition as { workspaceTypes: { spawn: Record<string, string> }[] })
      .workspaceTypes;
    for (const [index, { spawn }] of workspaceTypes.slice(0, 2).entries()) {
      const child = (await worker.invoke({
        handlerId: spawn[HANDLER_MARKER]!,
        context: {},
        surface: { kind: "object", members: {} },
        args: [],
      })) as ProcessHandle;
      await child.started;
      await child.write(new Uint8Array([1, 2]));
      await child.write(new Uint8Array([3, 4]));
      if (index === 0) await child.end();
      else await child.kill("SIGTERM");
      const output = [];
      for await (const event of await child.events()) output.push(event);
      const exit = index === 0 ? { code: 0, signal: null } : { code: null, signal: "SIGTERM" };
      expect(await child.exited).toEqual(exit);
      expect(output).toEqual([
        { type: "stdout", data: new Uint8Array([1, 2]) },
        { type: "stdout", data: new Uint8Array([3, 4]) },
        { type: "exit", exit },
      ]);
    }
  } finally {
    await worker.stop();
  }
});

test("materialized workspace provider handles retain cleanup after the direct child exits", async () => {
  const worker = await start();
  try {
    const workspaceTypes = (worker.definition as { workspaceTypes: { spawn: Record<string, string> }[] })
      .workspaceTypes;
    for (const cleanup of ["kill", "owner close", "confirmed exit"] as const) {
      const confirmed = cleanup === "confirmed exit";
      const materialized = (await worker.invoke({
        handlerId: workspaceTypes[2]!.spawn[HANDLER_MARKER]!,
        context: {},
        surface: { kind: "object", members: {} },
        args: [confirmed],
      })) as ProcessHandle;
      if (confirmed) expect(materialized.treeExited).toBeInstanceOf(Promise);
      else expect(materialized.treeExited).toBeUndefined();
      const owner = createProcessOwner();
      const child = createProcessHandleProxy(Promise.resolve(materialized));
      owner.adopt(child);
      expect(await child.exited).toEqual({ code: 0, signal: null });
      if (cleanup === "kill") await child.kill();
      if (confirmed) await child.treeExited;
      await owner.close();
      await child.treeExited;
      const output = [];
      for await (const event of await materialized.events()) output.push(event);
      expect(output).toEqual([{ type: "stdout", data: new Uint8Array([confirmed ? 0 : 1]) }]);
    }
  } finally {
    await worker.stop();
  }
});

test.each([
  "process",
  "terminal",
])("the host-call limit refuses more work while letting a %s handle close", async (kind) => {
  const worker = await start();
  const previous = HOST_CALL_LIMITS.inFlight;
  HOST_CALL_LIMITS.inFlight = 5;
  try {
    const gate = Promise.withResolvers<void>();
    let terminalKills = 0;
    const context = {
      projectId: "p1",
      open: () => {
        const child = createProcessHandleProxy(
          Promise.resolve({
            id: "fixture-child",
            started: Promise.resolve(),
            exited: Promise.resolve({ code: 0, signal: null }),
            write: async () => {},
            end: async () => {},
            kill: async () => {},
            events: async function* () {},
          }),
        );
        return { started: child.started, kill: child.kill };
      },
      terminal: {
        openSession: () => ({
          id: "fixture-terminal",
          kill: async () => {
            terminalKills += 1;
          },
          events: async function* () {
            yield { kind: "title", title: "Fixture terminal" };
          },
        }),
      },
      storage: { collection: () => ({ get: () => gate.promise.then(() => null), put: async () => {} }) },
      release: () => gate.resolve(),
    };
    // A one-way call: it does not count against the limit the held calls fill.
    const flood: BackendSurface = {
      kind: "object",
      members: {
        ...(surface as Extract<BackendSurface, { kind: "object" }>).members,
        open: { kind: "handle", members: { started: "promise", kill: "async" } },
        terminal: extensionContextSurface(context).members.terminal!,
        release: { kind: "notify" },
      },
    };
    expect(
      await worker.invoke({
        handlerId: handlerOf(worker.definition, "flood"),
        context,
        surface: flood,
        args: [kind, 8, 3],
      }),
    ).toEqual({
      refusedCodes: ["extension_overloaded", "extension_overloaded", "extension_overloaded"],
      cleanup: "killed",
    });
    expect(terminalKills).toBe(kind === "terminal" ? 1 : 0);
    expect(
      await worker.invoke({
        handlerId: handlerOf(worker.definition, "flood"),
        context,
        surface: flood,
        args: [kind, 3],
      }),
    ).toEqual({ refusedCodes: [], cleanup: "killed" });
    expect(terminalKills).toBe(kind === "terminal" ? 2 : 0);
  } finally {
    HOST_CALL_LIMITS.inFlight = previous;
    await worker.stop();
  }
});

test("a rejection extension code leaves unhandled does not stop the worker", async () => {
  const worker = await start();
  try {
    const call = () =>
      worker.invoke({ handlerId: handlerOf(worker.definition, "stray-rejection"), context: {}, surface, args: [] });
    const first = await call();
    expect(await call()).toBe(first);
  } finally {
    await worker.stop();
  }
});

test("stopping a worker releases the deadline for its cancelled handler", async () => {
  const drainDeadlineMs = 100_007;
  const worker = await startBackendWorker({
    command: backendWorkerCommand(),
    env: createExtensionProcessEnvironment(),
    entryPath,
    drainDeadlineMs,
  });
  const schedule = spyOn(globalThis, "setTimeout");
  const clear = spyOn(globalThis, "clearTimeout");
  let stopping: Promise<void> | undefined;
  try {
    const controller = new AbortController();
    const ready = Promise.withResolvers<void>();
    const running = worker.invoke({
      handlerId: handlerOf(worker.definition, "ignore-cancel"),
      context: { live: { ready: () => ready.resolve() } },
      surface: drainSurface,
      args: [],
      signal: controller.signal,
    });
    await ready.promise;
    controller.abort(new Error("stop"));
    await expectRejection(running).toThrow("stop");
    const scheduled = schedule.mock.calls.findIndex(([, delay]) => delay === drainDeadlineMs);
    expect(scheduled).toBeGreaterThanOrEqual(0);
    const drainTimer = schedule.mock.results[scheduled]!.value;
    stopping = worker.stop();
    await stopping;
    expect(clear.mock.calls.some(([timer]) => timer === drainTimer)).toBe(true);
  } finally {
    schedule.mockRestore();
    clear.mockRestore();
    await (stopping ?? worker.stop());
  }
});
