import { describe, expect, test } from "bun:test";
import { createCommandRunner } from "./runner";
import { buildRuntime, makeRunner, makeStorage, stubEnvironment } from "./test-helpers.test";

describe("createCommandRunner: hooks and nesting", () => {
  test("dispatches host events to extension hooks with worktree helpers", async () => {
    const { api: storage } = makeStorage();
    const bootstraps: unknown[] = [];
    const runtime = buildRuntime({
      hooks: {
        onWorktreeCreated: {
          eventId: "worktree.created",
          async handler(ctx, event) {
            await ctx.worktrees.bootstrap({
              repoPath: event.repoPath as string,
              worktreePath: event.worktreePath as string,
            });
          },
        },
      },
    });
    const runner = createCommandRunner(runtime, {
      buildEnvironment: () => ({
        ...stubEnvironment(storage),
        worktrees: {
          bootstrap: async (input) => {
            bootstraps.push(input);
          },
        },
      }),
    });

    const worktreeResult = await runner.dispatchEvent({
      eventId: "worktree.created",
      projectId: "p1",
      payload: {
        repoPath: "/repo",
        worktreePath: "/worktree",
        anchors: [{ type: "ticket", id: "PS-1", label: "PS-1" }],
      },
    });

    expect(worktreeResult.delivered).toBe(1);
    expect(bootstraps).toEqual([{ repoPath: "/repo", worktreePath: "/worktree" }]);
  });

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
