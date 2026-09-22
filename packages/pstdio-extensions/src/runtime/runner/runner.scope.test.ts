import { describe, expect, test } from "bun:test";
import { type ExtensionTerminalApi, type TerminalSessionHandle, workspaceEvents } from "@pstdio/sdk/extensions";
import { createCommandRunner } from "./runner";
import { buildRuntime, makeStorage, stubEnvironment } from "./test-helpers.test";

// A host terminal that hands every session it opens to the invocation scope, the way the
// API host does. The log records what stayed open and the order sessions were released in.
const trackingTerminalHost = () => {
  const closed: string[] = [];
  const live = new Set<string>();

  const terminalFor = (register: (dispose: () => void) => void): ExtensionTerminalApi => ({
    openSession: (request) => {
      const id = request.command?.[0] ?? "session";
      live.add(id);
      register(() => {
        live.delete(id);
        closed.push(id);
      });
      return { id, write: () => {}, resize: () => {}, kill: async () => {}, events: () => (async function* () {})() };
    },
  });

  return { closed, live, terminalFor };
};

const makeScopedRunner = (definition: Parameters<typeof buildRuntime>[0]) => {
  const host = trackingTerminalHost();
  const { api: storage } = makeStorage();
  const base = stubEnvironment(storage);
  const runner = createCommandRunner(buildRuntime(definition), {
    buildEnvironment: () => ({
      ...base,
      withScope: (scope) => ({
        sessions: base.sessions,
        workspaces: base.workspaces,
        connections: base.connections,
        process: base.process,
        terminal: host.terminalFor((dispose) => scope.register(dispose)),
      }),
    }),
  });
  return { host, runner };
};

const openSession = (terminal: ExtensionTerminalApi | undefined, name: string): TerminalSessionHandle =>
  (terminal as ExtensionTerminalApi).openSession({ command: [name], cols: 80, rows: 24 });

describe("createCommandRunner: invocation resources", () => {
  test("releases what a command opened after it returns", async () => {
    const { host, runner } = makeScopedRunner({
      commands: [
        {
          id: "probe",
          ref: { kind: "command", id: "probe" },
          title: "Probe",
          async run(ctx) {
            openSession(ctx.terminal, "returning");
            return {};
          },
        },
      ],
    });

    const outcome = await runner.execute({ commandId: "pstdio.lab.command.probe", projectId: "p1" });

    expect(outcome.ok).toBe(true);
    expect([...host.live]).toEqual([]);
  });

  test("releases what a command opened after it throws", async () => {
    const { host, runner } = makeScopedRunner({
      commands: [
        {
          id: "probe",
          ref: { kind: "command", id: "probe" },
          title: "Probe",
          async run(ctx) {
            openSession(ctx.terminal, "throwing");
            throw new Error("handler exploded");
          },
        },
      ],
    });

    const outcome = await runner.execute({ commandId: "pstdio.lab.command.probe", projectId: "p1" });

    expect(outcome.status).toBe("error");
    expect([...host.live]).toEqual([]);
  });

  test("releases what a command opened when the host cancels it", async () => {
    const controller = new AbortController();
    let commandSignal: AbortSignal | undefined;
    const { host, runner } = makeScopedRunner({
      commands: [
        {
          id: "probe",
          ref: { kind: "command", id: "probe" },
          title: "Probe",
          async run(ctx) {
            commandSignal = ctx.signal;
            openSession(ctx.terminal, "cancelled");
            controller.abort(new Error("cancelled"));
            return {};
          },
        },
      ],
    });

    await runner.execute({
      commandId: "pstdio.lab.command.probe",
      projectId: "p1",
      signal: controller.signal,
    });

    expect(commandSignal?.aborted).toBe(true);
    expect([...host.live]).toEqual([]);
  });

  test("leaves work the command handed to the host running after it returns", async () => {
    let commandSignal: AbortSignal | undefined;
    const { runner } = makeScopedRunner({
      commands: [
        {
          id: "probe",
          ref: { kind: "command", id: "probe" },
          title: "Probe",
          async run(ctx) {
            // Commands pass ctx.signal to host work that outlives them, such as an agent
            // session started through ctx.sessions.create().
            commandSignal = ctx.signal;
            return {};
          },
        },
      ],
    });

    await runner.execute({ commandId: "pstdio.lab.command.probe", projectId: "p1" });

    expect(commandSignal?.aborted).toBe(false);
  });

  test("closes a nested command's resources before its caller's", async () => {
    const { host, runner } = makeScopedRunner({
      commands: [
        {
          id: "outer",
          ref: { kind: "command", id: "outer" },
          title: "Outer",
          async run(ctx) {
            openSession(ctx.terminal, "outer");
            await ctx.commands.execute({ kind: "command", id: "inner" }, { params: {} });
            return {};
          },
        },
        {
          id: "inner",
          ref: { kind: "command", id: "inner" },
          title: "Inner",
          async run(ctx) {
            openSession(ctx.terminal, "inner");
            return {};
          },
        },
      ],
    });

    await runner.execute({ commandId: "pstdio.lab.command.outer", projectId: "p1" });

    expect(host.closed).toEqual(["inner", "outer"]);
  });

  test("releases what a private handler opened", async () => {
    const { host, runner } = makeScopedRunner({
      views: [
        {
          id: "editor",
          ref: { kind: "view", id: "editor" },
          title: "Editor",
          body: {
            kind: "file",
            load: async (ctx: { terminal?: ExtensionTerminalApi }) => {
              openSession(ctx.terminal, "private");
              return { content: "" };
            },
            save: async () => {},
          },
        },
      ],
    });

    const outcome = await runner.execute({ commandId: "pstdio.lab.view.editor.file.load", projectId: "p1" });

    expect(outcome.ok).toBe(true);
    expect([...host.live]).toEqual([]);
  });

  test("releases what a host command's middleware opened", async () => {
    const { host, runner } = makeScopedRunner({
      middlewares: [
        {
          id: "observeHost",
          ref: { kind: "middleware", id: "observeHost" },
          command: { extensionId: "pstdio", kind: "command", id: "kernel.workspace.rename" },
          async run(ctx) {
            openSession(ctx.terminal, "host-middleware");
            return ctx.commands.continue();
          },
        },
      ],
    });

    const outcome = await runner.executeHostCommand({
      commandId: "kernel.workspace.rename",
      projectId: "p1",
      run: async () => ({ ok: true }),
    });

    expect(outcome.ok).toBe(true);
    expect([...host.live]).toEqual([]);
  });

  test("releases what an event hook opened", async () => {
    const { host, runner } = makeScopedRunner({
      hooks: [
        {
          id: "onProvision",
          ref: { kind: "hook", id: "onProvision" },
          event: workspaceEvents.provision,
          async run(ctx) {
            openSession(ctx.terminal, "hook");
          },
        },
      ],
    });

    const result = await runner.dispatchEvent({ eventId: "workspace.provision", projectId: "p1" });

    expect(result.delivered).toBe(1);
    expect([...host.live]).toEqual([]);
  });
});
