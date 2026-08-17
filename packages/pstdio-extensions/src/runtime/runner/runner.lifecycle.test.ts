import { describe, expect, test } from "bun:test";
import { makeRunner } from "./test-helpers.test";

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

  test("reports explicitly emitted events to the host", async () => {
    const events: string[] = [];
    const runner = makeRunner(
      {
        commands: {
          update: {
            title: "Update",
            async run(ctx) {
              await ctx.events.emit("tickets.changed", { ticketId: "PS-1" });
            },
          },
        },
      },
      { onDidDispatchEvent: (eventId) => events.push(eventId) },
    );

    await runner.execute({ commandId: "lab.update", projectId: "p1" });

    expect(events).toEqual([
      "command.requested:lab.update",
      "command.started:lab.update",
      "tickets.changed",
      "command.completed:lab.update",
    ]);
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

  test("executes a private renderer handler without registering a public command", async () => {
    const runner = makeRunner({
      kanbanRenderers: {
        rows: {
          title: "Rows",
          query: async (_ctx, params) => ({
            rows: [{ id: String(params.renderer.rendererId), title: "Rows", attributes: {} }],
          }),
        },
      },
    });

    const outcome = await runner.execute({
      commandId: "lab.rows.kanban.query",
      projectId: "p1",
      params: { renderer: { rendererId: "lab.rows" } },
    });

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.value).toEqual({ rows: [{ id: "lab.rows", title: "Rows", attributes: {} }] });
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

  test("exposes project context to command handlers", async () => {
    const runner = makeRunner({
      commands: {
        inspect: {
          title: "Inspect",
          async run(ctx) {
            return { projectId: ctx.projectId, project: ctx.project };
          },
        },
      },
    });

    const outcome = await runner.execute({ commandId: "lab.inspect", projectId: "p1" });

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.value).toEqual({
        projectId: "p1",
        project: { id: "p1", name: "Prompt Studio", shorthand: "PS" },
      });
    }
  });
});
