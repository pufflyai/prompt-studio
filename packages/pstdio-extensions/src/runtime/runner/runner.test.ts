import { describe, expect, test } from "bun:test";
import type { ExtensionDefinition } from "@pstdio/sdk/extensions";
import type { ExtensionRuntime } from "../../types/runtime";
import { normalizeExtensionSources } from "../normalize";
import { type CommandRunnerEnvironment, createCommandRunner } from "./runner";

const makeStorage = () => {
  const state = new Map<string, unknown>();
  const api: CommandRunnerEnvironment["storage"] = {
    scope: () => api,
    get: async (key) => state.get(String(key)) as never,
    set: async (key, value) => {
      state.set(String(key), value);
    },
    delete: async (key) => {
      state.delete(String(key));
    },
    collection: () => {
      throw new Error("collection not implemented in test");
    },
  };
  return { api, state };
};

const stubEnvironment = (storage: CommandRunnerEnvironment["storage"]): CommandRunnerEnvironment => ({
  storage,
  artifacts: { mount: () => ({}) as never },
  files: {
    readText: async () => "",
    writeText: async () => {},
    createText: async () => ({ id: "" }),
    delete: async () => {},
  },
  sessions: {
    create: async () => ({ id: "" }),
    followup: async () => {},
  },
  workspaces: {
    get: async () => null,
    create: async () => null,
    archive: async () => {},
    delete: async () => {},
  },
  repos: {
    list: async () => [],
    get: async () => ({}) as never,
    getDefault: async () => undefined,
    resolvePath: async (_repoId, relativePath) => relativePath,
  },
  activity: { record: async () => ({ id: "" }) },
  notify: { toast: async () => {} },
  process: {
    run: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
    spawnDetached: async () => ({}),
  },
  net: { findFreePort: async () => 0 },
  settings: {
    all: async () => ({}),
    get: async () => undefined,
    set: async () => {},
    delete: async () => {},
  },
});

const buildRuntime = (definition: ExtensionDefinition): ExtensionRuntime =>
  normalizeExtensionSources([
    {
      packagePath: "/tmp/lab",
      sourcePath: "/tmp/lab/extension.ts",
      sourceKind: "local",
      manifest: {
        id: "pstdio.lab",
        name: "lab",
        version: "1.0.0",
        publisher: "pstdio",
        main: "./extension.ts",
        enginesPstdio: "^1.0.0",
      },
      definition,
    },
  ]);

const makeRunner = (definition: ExtensionDefinition, opts: { maxDepth?: number } = {}) => {
  const runtime = buildRuntime(definition);
  const { api: storage } = makeStorage();
  return createCommandRunner(runtime, {
    buildEnvironment: () => stubEnvironment(storage),
    maxDepth: opts.maxDepth,
  });
};

describe("createCommandRunner: lifecycle", () => {
  test("runs a command and emits requested/started/completed lifecycle events", async () => {
    const events: string[] = [];

    const runner = makeRunner({
      commands: {
        "counter.bump": {
          title: "Bump counter",
          async run(ctx) {
            const current = ((await ctx.storage.get<number>("counter")) ?? 0) as number;
            const next = current + 1;
            await ctx.storage.set("counter", next);
            return { counter: next };
          },
        },
      },
      hooks: {
        observeAll: {
          eventId: "command.completed:lab.counter.bump",
          handler: async () => {
            events.push("completed");
          },
        },
        observeStarted: {
          eventId: "command.started:lab.counter.bump",
          handler: async () => {
            events.push("started");
          },
        },
        observeRequested: {
          eventId: "command.requested:lab.counter.bump",
          handler: async () => {
            events.push("requested");
          },
        },
      },
    });

    const outcome = await runner.execute({
      commandId: "lab.counter.bump",
      projectId: "p1",
      source: "cli",
    });

    expect(outcome.ok).toBe(true);
    expect(outcome.status).toBe("success");
    if (outcome.ok) expect(outcome.value).toEqual({ counter: 1 });
    expect(events).toEqual(["requested", "started", "completed"]);
  });

  test("handler exception emits failed event and returns error outcome", async () => {
    const events: string[] = [];

    const runner = makeRunner({
      commands: {
        boom: {
          title: "Boom",
          async run() {
            throw new Error("kaboom");
          },
        },
      },
      hooks: {
        onFailed: {
          eventId: "command.failed:lab.boom",
          handler: async () => {
            events.push("failed");
          },
        },
      },
    });

    const outcome = await runner.execute({ commandId: "lab.boom", projectId: "p1" });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok && outcome.status === "error") {
      expect(outcome.reason).toBe("kaboom");
      expect(outcome.code).toBe("handler_threw");
    }
    expect(events).toEqual(["failed"]);
  });

  test("returns command_not_found when the id is unknown", async () => {
    const runner = makeRunner({});
    const outcome = await runner.execute({ commandId: "lab.missing", projectId: "p1" });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok && outcome.status === "error") {
      expect(outcome.code).toBe("command_not_found");
    }
  });

  test("collects command toast notices in the outcome", async () => {
    const runner = makeRunner({
      commands: {
        hello: {
          title: "Hello",
          async run(ctx) {
            await ctx.notify.toast({ type: "info", title: "Lab", message: "Hello from the lab" });
            return { ok: true };
          },
        },
      },
    });

    const outcome = await runner.execute({ commandId: "lab.hello", projectId: "p1" });

    expect(outcome.ok).toBe(true);
    expect(outcome.notices).toEqual([{ type: "info", title: "Lab", message: "Hello from the lab" }]);
  });
});

describe("createCommandRunner: middleware", () => {
  test("middleware reject short-circuits and emits command.rejected", async () => {
    const seen: string[] = [];

    const runner = makeRunner({
      commands: {
        awaken: {
          title: "Awaken",
          async run() {
            seen.push("ran");
            return {};
          },
        },
      },
      middlewares: {
        rejectAwaken: {
          commandId: "lab.awaken",
          async handler(ctx) {
            return ctx.commands.reject({ code: "no_consciousness", reason: "refusing" });
          },
        },
      },
      hooks: {
        observeRejected: {
          eventId: "command.rejected:lab.awaken",
          handler: async () => {
            seen.push("rejected");
          },
        },
      },
    });

    const outcome = await runner.execute({ commandId: "lab.awaken", projectId: "p1" });
    expect(outcome.ok).toBe(false);
    expect(outcome.status).toBe("rejected");
    if (!outcome.ok && outcome.status === "rejected") {
      expect(outcome.code).toBe("no_consciousness");
      expect(outcome.reason).toBe("refusing");
    }
    expect(seen).toEqual(["rejected"]);
  });

  test("middleware can replace params before the handler runs", async () => {
    let observed: unknown;

    const runner = makeRunner({
      commands: {
        echo: {
          title: "Echo",
          async run(ctx) {
            observed = ctx.params;
            return ctx.params;
          },
        },
      },
      middlewares: {
        rewrite: {
          commandId: "lab.echo",
          async handler(ctx) {
            return ctx.commands.patchParams({ extra: "added" });
          },
        },
      },
    });

    const outcome = await runner.execute({
      commandId: "lab.echo",
      projectId: "p1",
      params: { original: true },
    });

    expect(outcome.ok).toBe(true);
    expect(observed).toEqual({ original: true, extra: "added" });
  });
});

describe("createCommandRunner: hooks and nesting", () => {
  test("hook errors are isolated and don't fail the command", async () => {
    const runner = makeRunner({
      commands: {
        ping: {
          title: "Ping",
          async run() {
            return { pong: true };
          },
        },
      },
      hooks: {
        crashy: {
          eventId: "command.completed:lab.ping",
          handler: async () => {
            throw new Error("hook explosion");
          },
        },
      },
    });

    const outcome = await runner.execute({ commandId: "lab.ping", projectId: "p1" });
    expect(outcome.ok).toBe(true);
  });

  test("nested command execution invokes middleware for the nested command", async () => {
    const order: string[] = [];

    const runner = makeRunner({
      commands: {
        outer: {
          title: "Outer",
          async run(ctx) {
            order.push("outer-start");
            const result = await ctx.commands.execute("lab.inner", { params: {} });
            order.push("outer-end");
            return result;
          },
        },
        inner: {
          title: "Inner",
          async run() {
            order.push("inner-run");
            return { inner: true };
          },
        },
      },
      middlewares: {
        innerMw: {
          commandId: "lab.inner",
          async handler() {
            order.push("inner-mw");
          },
        },
      },
    });

    const outcome = await runner.execute({ commandId: "lab.outer", projectId: "p1" });
    expect(outcome.ok).toBe(true);
    expect(order).toEqual(["outer-start", "inner-mw", "inner-run", "outer-end"]);
  });

  test("recursive command execution is rejected past the depth limit", async () => {
    const runner = makeRunner(
      {
        commands: {
          loop: {
            title: "Loop",
            async run(ctx) {
              return ctx.commands.execute("lab.loop", { params: {} });
            },
          },
        },
      },
      { maxDepth: 3 },
    );

    const outcome = await runner.execute({ commandId: "lab.loop", projectId: "p1" });
    expect(JSON.stringify(outcome)).toContain("nested_depth_exceeded");
  });
});
