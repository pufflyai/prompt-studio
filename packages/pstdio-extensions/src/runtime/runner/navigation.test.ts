import { describe, expect, test } from "bun:test";
import { defineCommand, type NavigationTarget } from "@pstdio/sdk/extensions";
import { makeRunner } from "./test-helpers.test";

const target = (id: string): NavigationTarget => ({ kind: "page", page: { kind: "page", id } });
const qualified = (id: string): NavigationTarget => ({
  kind: "page",
  page: { kind: "page", id, extensionId: "pstdio.lab" },
});

describe("handler navigation", () => {
  test("delivers explicit navigation separately from command data", async () => {
    const create = defineCommand({
      id: "create",
      title: "Create",
      run(ctx) {
        ctx.navigation.open(target("notes"));
        return { id: "note-1" };
      },
    });
    const runner = makeRunner({ commands: [create] });
    expect(
      await runner.execute({ commandId: "pstdio.lab.command.create", projectId: "p1", source: "dashboard" }),
    ).toEqual({ ok: true, status: "success", value: { id: "note-1" }, navigationRequests: [qualified("notes")] });
    expect(await runner.execute({ commandId: "pstdio.lab.command.create", projectId: "p1", source: "cli" })).toEqual({
      ok: true,
      status: "success",
      value: { id: "note-1" },
    });
  });

  test("collects successful nested requests once and discards failed child requests", async () => {
    const child = defineCommand({
      id: "child",
      title: "Child",
      run(ctx) {
        ctx.navigation.open(target("child"));
      },
    });
    const failed = defineCommand({
      id: "failed",
      title: "Failed",
      run(ctx) {
        ctx.navigation.open(target("failed"));
        throw new Error("failed after request");
      },
    });
    const parent = defineCommand({
      id: "parent",
      title: "Parent",
      async run(ctx) {
        ctx.navigation.open(target("before"));
        const result = await ctx.commands.execute(child.ref, { params: {} });
        expect(result).not.toHaveProperty("navigationRequests");
        await ctx.commands.execute(failed.ref, { params: {} });
        ctx.navigation.open(target("after"));
        return "done";
      },
    });
    const result = await makeRunner({ commands: [parent, child, failed] }).execute({
      commandId: "pstdio.lab.command.parent",
      projectId: "p1",
      source: "dashboard",
    });
    expect(result).toEqual({
      ok: true,
      status: "success",
      value: "done",
      navigationRequests: [qualified("before"), qualified("child"), qualified("after")],
    });
  });

  test("a failed root delivers no navigation", async () => {
    const fail = defineCommand({
      id: "fail",
      title: "Fail",
      run(ctx) {
        ctx.navigation.open(target("notes"));
        throw new Error("cannot create");
      },
    });
    const result = await makeRunner({ commands: [fail] }).execute({
      commandId: "pstdio.lab.command.fail",
      projectId: "p1",
      source: "dashboard",
    });
    expect(result.ok).toBe(false);
    expect(result).not.toHaveProperty("navigationRequests");
  });
});

test("overlapping nested commands preserve the order in which requests were recorded", async () => {
  let release = () => {};
  let started = () => {};
  const ready = new Promise<void>((resolve) => {
    started = resolve;
  });
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  const child = defineCommand({
    id: "child",
    title: "Child",
    async run(ctx) {
      ctx.navigation.open(target("child"));
      started();
      await blocked;
    },
  });
  const parent = defineCommand({
    id: "parent",
    title: "Parent",
    async run(ctx) {
      const pending = ctx.commands.execute(child.ref, { params: {} });
      await ready;
      ctx.navigation.open(target("parent"));
      release();
      await pending;
    },
  });
  const outcome = await makeRunner({ commands: [parent, child] }).execute({
    commandId: "pstdio.lab.command.parent",
    projectId: "p1",
    source: "dashboard",
  });
  expect(outcome).toMatchObject({ navigationRequests: [qualified("child"), qualified("parent")] });
});

test("event hooks do not inherit navigation from the UI that emitted the event", async () => {
  const ping = defineCommand({
    id: "ping",
    title: "Ping",
    async run(ctx) {
      await ctx.events.emit({ kind: "event", id: "changed" }, {});
      ctx.navigation.open(target("requested"));
    },
  });
  let calls = 0;
  const runner = makeRunner({
    commands: [ping],
    hooks: [
      {
        id: "observe",
        ref: { kind: "hook", id: "observe" },
        event: { kind: "event", id: "changed" },
        run(ctx) {
          calls++;
          ctx.navigation.open(target("hook"));
        },
      },
    ],
  });
  expect(
    await runner.execute({ commandId: "pstdio.lab.command.ping", projectId: "p1", source: "dashboard" }),
  ).toMatchObject({ navigationRequests: [qualified("requested")] });
  expect(calls).toBe(1);
  expect(
    await runner.execute({ commandId: "pstdio.lab.command.ping", projectId: "p1", source: "schedule" }),
  ).not.toHaveProperty("navigationRequests");
});

test("private interaction callbacks use handler navigation with scoped resources", async () => {
  const { createCommandRunner } = await import("./runner");
  const { buildRuntime, makeStorage, stubEnvironment } = await import("./test-helpers.test");
  const { defineView } = await import("@pstdio/sdk/extensions");
  const view = defineView({
    id: "notes",
    title: "Notes",
    body: {
      kind: "dataTable",
      query: async () => ({ rows: [] }),
      onRowActivate(ctx) {
        ctx.navigation.open({
          kind: "page",
          page: { kind: "page", id: "notes" },
          resource: { type: "note", id: "one" },
        });
      },
    },
  });
  const runtime = buildRuntime({ views: [view] });
  const handler = runtime.privateHandlers.find((record) => record.operation === "onRowActivate")!;
  expect(handler).toBeDefined();
  const runner = createCommandRunner(runtime, { buildEnvironment: () => stubEnvironment(makeStorage().api) });
  expect(
    await runner.execute({ commandId: handler.id, source: "dashboard", projectId: "p1", params: { row: {} } }),
  ).toMatchObject({
    navigationRequests: [
      { ...qualified("notes"), resource: { type: "note", id: "one", extensionId: "pstdio.lab", projectId: "p1" } },
    ],
  });
});

test("nested navigation keeps the child extension's identity", async () => {
  const { createCommandRunner } = await import("./runner");
  const { buildRuntime, makeStorage, stubEnvironment } = await import("./test-helpers.test");
  const child = defineCommand({
    id: "child",
    title: "Child",
    run(ctx) {
      ctx.navigation.open(target("notes"));
    },
  });
  const parent = defineCommand({
    id: "parent",
    title: "Parent",
    async run(ctx) {
      await ctx.commands.execute({ kind: "command", extensionId: "other.notes", id: "child" }, { params: {} });
    },
  });
  const runtime = buildRuntime({ commands: [parent, child] });
  const childRecord = runtime.commands.find((record) => record.localId === "child")!;
  childRecord.extensionId = "other.notes";
  childRecord.id = "other.notes.command.child";
  const runner = createCommandRunner(runtime, { buildEnvironment: () => stubEnvironment(makeStorage().api) });
  expect(
    await runner.execute({ commandId: "pstdio.lab.command.parent", source: "dashboard", projectId: "p1" }),
  ).toMatchObject({
    navigationRequests: [{ kind: "page", page: { kind: "page", id: "notes", extensionId: "other.notes" } }],
  });
});
