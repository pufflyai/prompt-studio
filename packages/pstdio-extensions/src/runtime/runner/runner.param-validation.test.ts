import { describe, expect, test } from "bun:test";
import { params } from "@pstdio/sdk/extensions";
import { makeRunner } from "./test-helpers.test";

describe("createCommandRunner: param validation", () => {
  test("rejects invalid params before the handler runs and emits command.rejected", async () => {
    const events: string[] = [];
    let handlerRan = false;

    const runner = makeRunner({
      commands: [
        {
          id: "bump",
          ref: { kind: "command", id: "bump" },
          title: "Bump",
          params: { amount: params.number({ required: true }) },
          async run() {
            handlerRan = true;
            return { ok: true };
          },
        },
      ],
      hooks: [
        {
          id: "observeRejected",
          ref: { kind: "hook", id: "observeRejected" },
          event: { kind: "event", id: "command.rejected:bump" },
          run: async () => {
            events.push("rejected");
          },
        },
      ],
    });

    const outcome = await runner.execute({
      commandId: "pstdio.lab.command.bump",
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
      commands: [
        {
          id: "bump",
          ref: { kind: "command", id: "bump" },
          title: "Bump",
          params: { amount: params.number({ required: true }) },
          async run() {
            handlerRan = true;
            return { ok: true };
          },
        },
      ],
    });

    const outcome = await runner.execute({ commandId: "pstdio.lab.command.bump", projectId: "p1", params: {} });

    expect(outcome.ok).toBe(false);
    expect(outcome.status).toBe("rejected");
    if (!outcome.ok && outcome.status === "rejected") {
      expect(outcome.code).toBe("invalid_params");
      expect(outcome.reason).toContain("amount");
    }
    expect(handlerRan).toBe(false);
  });

  test("accepts valid params and passes them as the handler payload", async () => {
    let observed: unknown;

    const runner = makeRunner({
      commands: [
        {
          id: "bump",
          ref: { kind: "command", id: "bump" },
          title: "Bump",
          params: { amount: params.number({ required: true }) },
          async run(ctx, commandParams) {
            observed = { commandParams, contextHasParams: "params" in ctx };
            return commandParams;
          },
        },
      ],
    });

    const outcome = await runner.execute({
      commandId: "pstdio.lab.command.bump",
      projectId: "p1",
      params: { amount: 2 },
    });

    expect(outcome.ok).toBe(true);
    expect(observed).toEqual({ commandParams: { amount: 2 }, contextHasParams: false });
  });

  test("omitting an optional param succeeds", async () => {
    const runner = makeRunner({
      commands: [
        {
          id: "bump",
          ref: { kind: "command", id: "bump" },
          title: "Bump",
          params: { note: params.text() },
          async run(_ctx, commandParams) {
            return commandParams;
          },
        },
      ],
    });

    const outcome = await runner.execute({ commandId: "pstdio.lab.command.bump", projectId: "p1", params: {} });

    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.value).toEqual({});
  });

  test("middleware-supplied invalid params are rejected before the handler runs", async () => {
    let handlerRan = false;

    const runner = makeRunner({
      commands: [
        {
          id: "bump",
          ref: { kind: "command", id: "bump" },
          title: "Bump",
          params: { amount: params.number({ required: true }) },
          async run() {
            handlerRan = true;
            return { ok: true };
          },
        },
      ],
      middlewares: [
        {
          id: "breakAmount",
          ref: { kind: "middleware", id: "breakAmount" },
          command: { kind: "command", id: "bump" },
          async run(ctx) {
            return ctx.commands.replaceParams({ amount: "not-a-number" });
          },
        },
      ],
    });

    const outcome = await runner.execute({
      commandId: "pstdio.lab.command.bump",
      projectId: "p1",
      params: { amount: 2 },
    });

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
      commands: [
        {
          id: "bump",
          ref: { kind: "command", id: "bump" },
          title: "Bump",
          params: { amount: params.number({ required: true }) },
          async run() {
            handlerRan = true;
            return { ok: true };
          },
        },
      ],
      middlewares: [
        {
          id: "removeParams",
          ref: { kind: "middleware", id: "removeParams" },
          command: { kind: "command", id: "bump" },
          async run(ctx) {
            return ctx.commands.replaceInvocation({
              commandId: ctx.commandId,
              resource: { type: "ticket", id: "PS-1" },
            } as never);
          },
        },
      ],
    });

    const outcome = await runner.execute({
      commandId: "pstdio.lab.command.bump",
      projectId: "p1",
      params: { amount: 2 },
    });

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
      commands: [
        {
          id: "bump",
          ref: { kind: "command", id: "bump" },
          title: "Bump",
          params: { amount: params.number({ required: true }) },
          async run(_ctx, commandParams) {
            observed = commandParams;
            return commandParams;
          },
        },
      ],
      middlewares: [
        {
          id: "fillAmount",
          ref: { kind: "middleware", id: "fillAmount" },
          command: { kind: "command", id: "bump" },
          async run(ctx) {
            return ctx.commands.patchParams({ amount: 5 });
          },
        },
      ],
    });

    const outcome = await runner.execute({ commandId: "pstdio.lab.command.bump", projectId: "p1" });

    expect(outcome.ok).toBe(true);
    expect(observed).toEqual({ amount: 5 });
  });

  test("a command with no declared params accepts any params payload", async () => {
    const runner = makeRunner({
      commands: [
        {
          id: "passthrough",
          ref: { kind: "command", id: "passthrough" },
          title: "Passthrough",
          async run(_ctx, commandParams) {
            return commandParams;
          },
        },
      ],
    });

    const outcome = await runner.execute({
      commandId: "pstdio.lab.command.passthrough",
      projectId: "p1",
      params: { anything: true, count: 42 },
    });

    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.value).toEqual({ anything: true, count: 42 });
  });
});
