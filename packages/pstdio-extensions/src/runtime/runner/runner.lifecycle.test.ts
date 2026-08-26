import { describe, expect, test } from "bun:test";
import { makeRunner } from "./test-helpers.test";

describe("createCommandRunner: lifecycle", () => {
  test("runs a command and emits requested/started/completed lifecycle events", async () => {
    const events: string[] = [];

    const runner = makeRunner({
      commands: [
        {
          id: "counter.bump",
          ref: { kind: "command", id: "counter.bump" },
          title: "Bump counter",
          async run(ctx) {
            const current = ((await ctx.storage.get<number>("counter")) ?? 0) as number;
            const next = current + 1;
            await ctx.storage.set("counter", next);
            return { counter: next };
          },
        },
      ],
      hooks: [
        {
          id: "observeAll",
          ref: { kind: "hook", id: "observeAll" },
          event: { kind: "event", id: "command.completed:counter.bump" },
          run: async () => {
            events.push("completed");
          },
        },
        {
          id: "observeStarted",
          ref: { kind: "hook", id: "observeStarted" },
          event: { kind: "event", id: "command.started:counter.bump" },
          run: async () => {
            events.push("started");
          },
        },
        {
          id: "observeRequested",
          ref: { kind: "hook", id: "observeRequested" },
          event: { kind: "event", id: "command.requested:counter.bump" },
          run: async () => {
            events.push("requested");
          },
        },
      ],
    });

    const outcome = await runner.execute({
      commandId: "pstdio.lab.command.counter.bump",
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
        commands: [
          {
            id: "update",
            ref: { kind: "command", id: "update" },
            title: "Update",
            async run(ctx) {
              await ctx.events.emit({ kind: "event", id: "tickets.changed" }, { ticketId: "PS-1" });
            },
          },
        ],
      },
      { onDidDispatchEvent: (eventId) => events.push(eventId) },
    );

    await runner.execute({ commandId: "pstdio.lab.command.update", projectId: "p1" });

    expect(events).toEqual([
      "command.requested:pstdio.lab.command.update",
      "command.started:pstdio.lab.command.update",
      "pstdio.lab.event.tickets.changed",
      "command.completed:pstdio.lab.command.update",
    ]);
  });

  test("handler exception emits failed event and returns error outcome", async () => {
    const events: string[] = [];

    const runner = makeRunner({
      commands: [
        {
          id: "boom",
          ref: { kind: "command", id: "boom" },
          title: "Boom",
          async run() {
            throw new Error("kaboom");
          },
        },
      ],
      hooks: [
        {
          id: "onFailed",
          ref: { kind: "hook", id: "onFailed" },
          event: { kind: "event", id: "command.failed:boom" },
          run: async () => {
            events.push("failed");
          },
        },
      ],
    });

    const outcome = await runner.execute({ commandId: "pstdio.lab.command.boom", projectId: "p1" });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok && outcome.status === "error") {
      expect(outcome.reason).toBe("kaboom");
      expect(outcome.code).toBe("handler_threw");
    }
    expect(events).toEqual(["failed"]);
  });

  test("returns command_not_found when the id is unknown", async () => {
    const runner = makeRunner({});
    const outcome = await runner.execute({ commandId: "pstdio.lab.command.missing", projectId: "p1" });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok && outcome.status === "error") {
      expect(outcome.code).toBe("command_not_found");
    }
  });

  test("executes a private renderer handler without registering a public command", async () => {
    const runner = makeRunner({
      views: [
        {
          id: "rows",
          ref: { kind: "view", id: "rows" },
          title: "Rows",
          body: {
            kind: "kanban",
            query: async (_ctx, params) => ({
              rows: [{ id: String(params.renderer.rendererId), title: "Rows", attributes: {} }],
            }),
          },
        },
      ],
    });

    const outcome = await runner.execute({
      commandId: "pstdio.lab.view.rows.kanban.query",
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
      commands: [
        {
          id: "hello",
          ref: { kind: "command", id: "hello" },
          title: "Hello",
          async run(ctx) {
            await ctx.notify.toast({ type: "info", title: "Lab", message: "Hello from the lab" });
            return { ok: true };
          },
        },
      ],
    });

    const outcome = await runner.execute({ commandId: "pstdio.lab.command.hello", projectId: "p1" });

    expect(outcome.ok).toBe(true);
    expect(outcome.notices).toEqual([{ type: "info", title: "Lab", message: "Hello from the lab" }]);
  });

  test("exposes project context to command handlers", async () => {
    const runner = makeRunner({
      commands: [
        {
          id: "inspect",
          ref: { kind: "command", id: "inspect" },
          title: "Inspect",
          async run(ctx) {
            return { projectId: ctx.projectId, project: ctx.project };
          },
        },
      ],
    });

    const outcome = await runner.execute({ commandId: "pstdio.lab.command.inspect", projectId: "p1" });

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.value).toEqual({
        projectId: "p1",
        project: { id: "p1", name: "Prompt Studio", shorthand: "PS" },
      });
    }
  });
});
