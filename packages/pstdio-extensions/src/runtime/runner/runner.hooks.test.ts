import { describe, expect, test } from "bun:test";
import type { BuildEnvironmentInput } from "./runner";
import { createCommandRunner } from "./runner";
import { buildRuntime, makeRunner, makeStorage, stubEnvironment } from "./test-helpers.test";

describe("createCommandRunner: hooks and nesting", () => {
  test("dispatches host events to extension hooks with workspace file helpers", async () => {
    const { api: storage } = makeStorage();
    const syncs: unknown[] = [];
    const runtime = buildRuntime({
      hooks: {
        onProvision: {
          eventId: "workspace.provision",
          async handler(ctx) {
            await ctx.workspaceFiles?.syncDir(".claude/skills", []);
          },
        },
      },
    });
    const runner = createCommandRunner(runtime, {
      buildEnvironment: () => ({
        ...stubEnvironment(storage),
        workspaceFiles: {
          syncDir: async (dir: string, files: unknown) => {
            syncs.push({ dir, files });
          },
        } as never,
      }),
    });

    const provisionResult = await runner.dispatchEvent({
      eventId: "workspace.provision",
      projectId: "p1",
      payload: {
        repoPath: "/repo",
        workspaceDir: "/worktree",
      },
    });

    expect(provisionResult.delivered).toBe(1);
    expect(syncs).toEqual([{ dir: ".claude/skills", files: [] }]);
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

  test("nested command execution keeps workspace-scoped environment", async () => {
    const runtime = buildRuntime({
      commands: {
        outer: {
          title: "Outer",
          async run(ctx) {
            const result = await ctx.commands.execute("lab.inner", { params: {} });
            return result.ok ? result.value : result;
          },
        },
        inner: {
          title: "Inner",
          async run(ctx) {
            await ctx.workspaceFiles?.writeText("generated.txt", "ok");
            return { workspaceId: ctx.workspaceId, hasWorkspaceFiles: Boolean(ctx.workspaceFiles) };
          },
        },
      },
    });
    const { api: storage } = makeStorage();
    const writes: unknown[] = [];
    const runner = createCommandRunner(runtime, {
      buildEnvironment: (input: BuildEnvironmentInput) => ({
        ...stubEnvironment(storage),
        workspaceId: input.workspaceId,
        workspaceFiles: input.workspaceDir
          ? ({
              writeText: async (path: string, value: string) => {
                writes.push({ path, value });
              },
            } as never)
          : undefined,
      }),
    });

    const outcome = await runner.execute({
      commandId: "lab.outer",
      projectId: "p1",
      workspaceDir: "/worktree",
      workspaceId: "ws-1",
    });

    expect(outcome).toEqual({
      ok: true,
      status: "success",
      value: { workspaceId: "ws-1", hasWorkspaceFiles: true },
    });
    expect(writes).toEqual([{ path: "generated.txt", value: "ok" }]);
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
