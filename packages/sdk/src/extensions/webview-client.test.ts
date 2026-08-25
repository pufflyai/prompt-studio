import { describe, expect, test } from "bun:test";
import { defineCommand } from "./define-command";
import type { GuestHost } from "./define-extension-view";
import { params } from "./params";
import { createWebviewClient } from "./webview-client";

const commands = {
  "ticketStatus.read": defineCommand({
    title: "Read ticket statuses",
    async run(_ctx, _commandParams) {
      return { statuses: ["todo"] };
    },
  }),
  "ticketStatus.create": defineCommand({
    title: "Create ticket status",
    params: { label: params.text({ required: true }) },
    async run(_ctx, commandParams) {
      return { id: commandParams.label };
    },
  }),
};

const settings = {
  properties: {
    "board.columns": { type: "number", scope: "project", default: 3 },
  },
} as const;

interface RecordedCall {
  method: string;
  params: unknown;
}

const createHost = (respond: (call: RecordedCall) => unknown, extensionId?: string) => {
  const calls: RecordedCall[] = [];
  const host: GuestHost = {
    extensionId,
    call: async <TResult>(method: string, params?: unknown) => {
      const call = { method, params };
      calls.push(call);
      return respond(call) as TResult;
    },
    onEvent: () => () => {},
  };
  return { host, calls };
};

const successOutcome = (value: unknown) => ({ outcome: { ok: true, status: "success", value } });

describe("createWebviewClient commands", () => {
  test("qualifies bare command keys with the host extension id", async () => {
    const { host, calls } = createHost(() => successOutcome({ statuses: [] }), "pstdio-planner");
    const client = createWebviewClient<typeof commands, typeof settings>(host);

    await client.commands["ticketStatus.read"]();

    expect(calls).toEqual([
      {
        method: "commands.execute",
        params: { commandId: "pstdio-planner.ticketStatus.read", params: undefined },
      },
    ]);
  });

  test("passes params and unwraps the success value", async () => {
    const { host, calls } = createHost(() => successOutcome({ id: "todo" }), "pstdio-planner");
    const client = createWebviewClient<typeof commands, typeof settings>(host);

    const created = await client.commands["ticketStatus.create"]({ label: "Todo" });

    expect(created).toEqual({ id: "todo" });
    expect(calls[0]?.params).toEqual({
      commandId: "pstdio-planner.ticketStatus.create",
      params: { label: "Todo" },
    });
  });

  test("throws the outcome reason when a command fails", async () => {
    const { host } = createHost(
      () => ({ outcome: { ok: false, status: "error", reason: "Ticket status exists." } }),
      "pstdio-planner",
    );
    const client = createWebviewClient<typeof commands, typeof settings>(host);

    await expect(client.commands["ticketStatus.create"]({ label: "Todo" })).rejects.toThrow("Ticket status exists.");
  });

  test("prefers an explicit extensionId option over the host id", async () => {
    const { host, calls } = createHost(() => successOutcome({ statuses: [] }), "pstdio-planner");
    const client = createWebviewClient<typeof commands, typeof settings>(host, { extensionId: "test-extension" });

    await client.commands["ticketStatus.read"]();

    expect(calls[0]?.params).toEqual({ commandId: "test-extension.ticketStatus.read", params: undefined });
  });

  test("throws when no extension id is available", () => {
    const { host } = createHost(() => successOutcome(null));

    expect(() => createWebviewClient<typeof commands, typeof settings>(host)).toThrow(/extension id/i);
  });
});

describe("createWebviewClient settings", () => {
  test("reads all settings", async () => {
    const { host, calls } = createHost(() => ({ "board.columns": 4 }), "pstdio-planner");
    const client = createWebviewClient<typeof commands, typeof settings>(host);

    const all = await client.settings.all();

    expect(all).toEqual({ "board.columns": 4 });
    expect(calls).toEqual([{ method: "extension.settings.all", params: {} }]);
  });

  test("reads one setting by key", async () => {
    const { host, calls } = createHost(() => 4, "pstdio-planner");
    const client = createWebviewClient<typeof commands, typeof settings>(host);

    const columns = await client.settings.get("board.columns");

    expect(columns).toBe(4);
    expect(calls).toEqual([{ method: "extension.settings.get", params: { key: "board.columns" } }]);
  });

  test("writes one setting by key", async () => {
    const { host, calls } = createHost(() => undefined, "pstdio-planner");
    const client = createWebviewClient<typeof commands, typeof settings>(host);

    await client.settings.set("board.columns", 5);

    expect(calls).toEqual([{ method: "extension.settings.set", params: { key: "board.columns", value: 5 } }]);
  });
});
