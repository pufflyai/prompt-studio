import { describe, expect, test } from "bun:test";
import { createCommandRunner } from "./runner";
import { buildRuntime, makeRunner, makeStorage, stubEnvironment } from "./test-helpers.test";

describe("createCommandRunner: middleware", () => {
  test("middleware reject short-circuits and emits command.rejected", async () => {
    const seen: string[] = [];

    const runner = makeRunner({
      commands: [
        {
          id: "awaken",
          ref: { kind: "command", id: "awaken" },
          title: "Awaken",
          async run() {
            seen.push("ran");
            return {};
          },
        },
      ],
      middlewares: [
        {
          id: "rejectAwaken",
          ref: { kind: "middleware", id: "rejectAwaken" },
          command: { kind: "command", id: "awaken" },
          async run(ctx) {
            return ctx.commands.reject({ code: "no_consciousness", reason: "refusing" });
          },
        },
      ],
      hooks: [
        {
          id: "observeRejected",
          ref: { kind: "hook", id: "observeRejected" },
          event: { kind: "event", id: "command.rejected:awaken" },
          run: async () => {
            seen.push("rejected");
          },
        },
      ],
    });

    const outcome = await runner.execute({ commandId: "pstdio.lab.command.awaken", projectId: "p1" });
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
      commands: [
        {
          id: "echo",
          ref: { kind: "command", id: "echo" },
          title: "Echo",
          async run(_ctx, commandParams) {
            observed = commandParams;
            return commandParams;
          },
        },
      ],
      middlewares: [
        {
          id: "rewrite",
          ref: { kind: "middleware", id: "rewrite" },
          command: { kind: "command", id: "echo" },
          async run(ctx, commandParams) {
            expect(commandParams).toEqual({ original: true });
            expect("params" in ctx).toBe(false);
            return ctx.commands.patchParams({ extra: "added" });
          },
        },
      ],
    });

    const outcome = await runner.execute({
      commandId: "pstdio.lab.command.echo",
      projectId: "p1",
      params: { original: true },
    });

    expect(outcome.ok).toBe(true);
    expect(observed).toEqual({ original: true, extra: "added" });
  });

  test("middleware can reject host-owned commands without a registered extension command", async () => {
    let hostRan = false;

    const runner = makeRunner({
      middlewares: [
        {
          id: "rejectHostCommand",
          ref: { kind: "middleware", id: "rejectHostCommand" },
          command: { extensionId: "pstdio", kind: "command", id: "kernel.workspace.rename" },
          async run(ctx) {
            expect(ctx.commandId).toBe("kernel.workspace.rename");
            expect(ctx.extensionId).toBe("pstdio.lab");
            return ctx.commands.reject({ code: "blocked", reason: "blocked by middleware" });
          },
        },
      ],
    });

    const outcome = await runner.executeHostCommand({
      commandId: "kernel.workspace.rename",
      projectId: "p1",
      params: { workspaceId: "ws-1", name: "Renamed" },
      async run() {
        hostRan = true;
        return { ok: true };
      },
    });

    expect(outcome.status).toBe("rejected");
    expect(hostRan).toBe(false);
  });

  test("middleware can patch params before a host-owned command runs", async () => {
    let observed: unknown;

    const runner = makeRunner({
      middlewares: [
        {
          id: "rewriteHostCommand",
          ref: { kind: "middleware", id: "rewriteHostCommand" },
          command: { extensionId: "pstdio", kind: "command", id: "kernel.workspace.rename" },
          async run(ctx) {
            return ctx.commands.patchParams({ name: "Review workspace" });
          },
        },
      ],
    });

    const outcome = await runner.executeHostCommand({
      commandId: "kernel.workspace.rename",
      projectId: "p1",
      params: { workspaceId: "ws-1", name: "Done workspace" },
      async run(invocation) {
        observed = invocation.params;
        return invocation.params;
      },
    });

    expect(outcome.ok).toBe(true);
    expect(observed).toEqual({ workspaceId: "ws-1", name: "Review workspace" });
  });

  test("host-owned command middleware receives the host cancellation signal", async () => {
    const controller = new AbortController();
    let middlewareSignal: AbortSignal | undefined;
    let hostRan = false;
    const runner = makeRunner({
      middlewares: [
        {
          id: "observeHostSignal",
          ref: { kind: "middleware", id: "observeHostSignal" },
          command: { extensionId: "pstdio", kind: "command", id: "kernel.workspace.rename" },
          async run(ctx) {
            middlewareSignal = ctx.signal;
            controller.abort(new Error("cancelled"));
            return ctx.commands.continue();
          },
        },
      ],
    });

    const outcome = await runner.executeHostCommand({
      commandId: "kernel.workspace.rename",
      projectId: "p1",
      params: { workspaceId: "ws-1", name: "Renamed" },
      signal: controller.signal,
      run: async () => {
        hostRan = true;
        return { ok: true };
      },
    });

    expect(middlewareSignal).toBe(controller.signal);
    expect(hostRan).toBe(false);
    expect(outcome.status).toBe("error");
  });

  test("signaled host commands fail before middleware when host helpers cannot be scoped", async () => {
    let middlewareRan = false;
    let hostRan = false;
    const runtime = buildRuntime({
      middlewares: [
        {
          id: "unsafeHostSignal",
          ref: { kind: "middleware", id: "unsafeHostSignal" },
          command: { extensionId: "pstdio", kind: "command", id: "kernel.workspace.rename" },
          async run(ctx) {
            middlewareRan = true;
            return ctx.commands.continue();
          },
        },
      ],
    });
    const { api: storage } = makeStorage();
    const { withSignal: _withSignal, ...unscopedEnvironment } = stubEnvironment(storage);
    const runner = createCommandRunner(runtime, { buildEnvironment: () => unscopedEnvironment });

    const outcome = await runner.executeHostCommand({
      commandId: "kernel.workspace.rename",
      projectId: "p1",
      signal: new AbortController().signal,
      run: async () => {
        hostRan = true;
      },
    });

    expect(outcome.status).toBe("error");
    expect(middlewareRan).toBe(false);
    expect(hostRan).toBe(false);
  });
});
