import { describe, expect, test } from "bun:test";
import { makeRunner } from "./test-helpers.test";

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
          async run(_ctx, commandParams) {
            observed = commandParams;
            return commandParams;
          },
        },
      },
      middlewares: {
        rewrite: {
          commandId: "lab.echo",
          async handler(ctx, commandParams) {
            expect(commandParams).toEqual({ original: true });
            expect("params" in ctx).toBe(false);
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

  test("middleware can reject host-owned commands without a registered extension command", async () => {
    let hostRan = false;

    const runner = makeRunner({
      middlewares: {
        rejectHostCommand: {
          commandId: "kernel.workspace.rename",
          async handler(ctx) {
            expect(ctx.commandId).toBe("kernel.workspace.rename");
            expect(ctx.extensionId).toBe("pstdio.lab");
            return ctx.commands.reject({ code: "blocked", reason: "blocked by middleware" });
          },
        },
      },
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
      middlewares: {
        rewriteHostCommand: {
          commandId: "kernel.workspace.rename",
          async handler(ctx) {
            return ctx.commands.patchParams({ name: "Review workspace" });
          },
        },
      },
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
});
