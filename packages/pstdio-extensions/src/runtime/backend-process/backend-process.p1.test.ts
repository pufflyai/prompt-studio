import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createExtensionProcessEnvironment } from "../process-environment";
import { backendWorkerCommand, createBackendWorkerPool } from "./pool";
import { HANDLER_MARKER } from "./protocol";
import { BackendUnavailableError, startBackendWorker } from "./supervisor";
import type { BackendSurface } from "./surface";

let root: string;
let entryPath: string;

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "backend-process-"));
  entryPath = join(root, "extension.ts");
  await writeFile(
    entryPath,
    `
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
      run: (ctx) => new Promise((resolve) => ctx.signal.addEventListener("abort", () => resolve("aborted"))),
    },
    { id: "crash", title: "Crash", run: () => process.exit(7) },
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
  process.env.PSTDIO_API_TOKEN = "runtime-token";
  process.env.OPENAI_API_KEY = "provider-key";
  const previousCwd = process.cwd();
  // Bun loads .env from a process's working directory; the worker must not start in the host's.
  await writeFile(join(root, ".env"), "SECRET_FROM_DOTENV=leaked\n");
  process.chdir(root);
  try {
    const worker = await start();
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
    delete process.env.PSTDIO_API_TOKEN;
    delete process.env.OPENAI_API_KEY;
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
