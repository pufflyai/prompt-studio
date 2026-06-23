import { describe, expect, test } from "bun:test";
import { params } from "@pstdio/sdk/extensions";
import { makeRunner } from "./test-helpers.test";

describe("createCommandRunner: param validation", () => {
  test("rejects invalid params before the handler runs and emits command.rejected", async () => {
    const events: string[] = [];
    let handlerRan = false;

    const runner = makeRunner({
      commands: {
        bump: {
          title: "Bump",
          params: { amount: params.number({ required: true }) },
          async run() {
            handlerRan = true;
            return { ok: true };
          },
        },
      },
      hooks: {
        observeRejected: {
          eventId: "command.rejected:lab.bump",
          handler: async () => {
            events.push("rejected");
          },
        },
      },
    });

    const outcome = await runner.execute({
      commandId: "lab.bump",
      projectId: "p1",
      params: { amount: "2" as unknown as number },
    });

    expect(outcome.ok).toBe(false);
    expect(outcome.status).toBe("rejected");
    if (!outcome.ok && outcome.status === "rejected") {
      expect(outcome.code).toBe("invalid_params");
      expect(outcome.reason).toContain("amount");
    }
    expect(handlerRan).toBe(false);
    expect(events).toEqual(["rejected"]);
  });

  test("rejects when a required param is missing", async () => {
    let handlerRan = false;

    const runner = makeRunner({
      commands: {
        bump: {
          title: "Bump",
          params: { amount: params.number({ required: true }) },
          async run() {
            handlerRan = true;
            return { ok: true };
          },
        },
      },
    });

    const outcome = await runner.execute({ commandId: "lab.bump", projectId: "p1", params: {} });

    expect(outcome.ok).toBe(false);
    expect(outcome.status).toBe("rejected");
    if (!outcome.ok && outcome.status === "rejected") {
      expect(outcome.code).toBe("invalid_params");
      expect(outcome.reason).toContain("amount");
    }
    expect(handlerRan).toBe(false);
  });

  test("accepts valid params and exposes them to the handler", async () => {
    let observed: unknown;

    const runner = makeRunner({
      commands: {
        bump: {
          title: "Bump",
          params: { amount: params.number({ required: true }) },
          async run(ctx) {
            observed = ctx.params;
            return ctx.params;
          },
        },
      },
    });

    const outcome = await runner.execute({ commandId: "lab.bump", projectId: "p1", params: { amount: 2 } });

    expect(outcome.ok).toBe(true);
    expect(observed).toEqual({ amount: 2 });
  });

  test("omitting an optional param succeeds", async () => {
    const runner = makeRunner({
      commands: {
        bump: {
          title: "Bump",
          params: { note: params.text() },
          async run(ctx) {
            return ctx.params;
          },
        },
      },
    });

    const outcome = await runner.execute({ commandId: "lab.bump", projectId: "p1", params: {} });

    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.value).toEqual({});
  });

  test("middleware-supplied invalid params are rejected before the handler runs", async () => {
    let handlerRan = false;

    const runner = makeRunner({
      commands: {
        bump: {
          title: "Bump",
          params: { amount: params.number({ required: true }) },
          async run() {
            handlerRan = true;
            return { ok: true };
          },
        },
      },
      middlewares: {
        breakAmount: {
          commandId: "lab.bump",
          async handler(ctx) {
            return ctx.commands.replaceParams({ amount: "not-a-number" });
          },
        },
      },
    });

    const outcome = await runner.execute({ commandId: "lab.bump", projectId: "p1", params: { amount: 2 } });

    expect(outcome.ok).toBe(false);
    expect(outcome.status).toBe("rejected");
    if (!outcome.ok && outcome.status === "rejected") {
      expect(outcome.code).toBe("invalid_params");
    }
    expect(handlerRan).toBe(false);
  });

  test("middleware-supplied malformed invocation params are rejected before the handler runs", async () => {
    let handlerRan = false;

    const runner = makeRunner({
      commands: {
        bump: {
          title: "Bump",
          params: { amount: params.number({ required: true }) },
          async run() {
            handlerRan = true;
            return { ok: true };
          },
        },
      },
      middlewares: {
        removeParams: {
          commandId: "lab.bump",
          async handler(ctx) {
            return ctx.commands.replaceInvocation({
              commandId: ctx.commandId,
              resource: { type: "ticket", id: "PS-1" },
            } as never);
          },
        },
      },
    });

    const outcome = await runner.execute({ commandId: "lab.bump", projectId: "p1", params: { amount: 2 } });

    expect(outcome.ok).toBe(false);
    expect(outcome.status).toBe("rejected");
    if (!outcome.ok && outcome.status === "rejected") {
      expect(outcome.code).toBe("invalid_params");
    }
    expect(handlerRan).toBe(false);
  });

  test("middleware patching params to a valid final shape still runs the handler", async () => {
    let observed: unknown;

    const runner = makeRunner({
      commands: {
        bump: {
          title: "Bump",
          params: { amount: params.number({ required: true }) },
          async run(ctx) {
            observed = ctx.params;
            return ctx.params;
          },
        },
      },
      middlewares: {
        fillAmount: {
          commandId: "lab.bump",
          async handler(ctx) {
            return ctx.commands.patchParams({ amount: 5 });
          },
        },
      },
    });

    const outcome = await runner.execute({ commandId: "lab.bump", projectId: "p1" });

    expect(outcome.ok).toBe(true);
    expect(observed).toEqual({ amount: 5 });
  });

  test("a command with no declared params accepts any params payload", async () => {
    const runner = makeRunner({
      commands: {
        passthrough: {
          title: "Passthrough",
          async run(ctx) {
            return ctx.params;
          },
        },
      },
    });

    const outcome = await runner.execute({
      commandId: "lab.passthrough",
      projectId: "p1",
      params: { anything: true, count: 42 },
    });

    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.value).toEqual({ anything: true, count: 42 });
  });
});
