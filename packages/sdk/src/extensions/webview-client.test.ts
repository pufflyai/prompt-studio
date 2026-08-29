import { describe, expect, test } from "bun:test";
import { defineCommand } from "./define-command";
import { defineArtifactMount } from "./define-contribution";
import type { GuestHost } from "./define-extension-view";
import { params } from "./params";
import { artifactsRead } from "./webview-capabilities";
import { createWebviewClient } from "./webview-client";

const commands = {
  "ticket-status.read": defineCommand({
    id: "ticket-status.read",
    title: "Read ticket statuses",
    async run(_ctx, _commandParams) {
      return { statuses: ["todo"] };
    },
  }),
  "ticket-status.create": defineCommand({
    id: "ticket-status.create",
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

    await client.commands["ticket-status.read"]();

    expect(calls).toEqual([
      {
        method: "commands.execute",
        params: { commandId: "pstdio-planner.command.ticket-status.read", params: undefined },
      },
    ]);
  });

  test("passes params and unwraps the success value", async () => {
    const { host, calls } = createHost(() => successOutcome({ id: "todo" }), "pstdio-planner");
    const client = createWebviewClient<typeof commands, typeof settings>(host);

    const created = await client.commands["ticket-status.create"]({ label: "Todo" });

    expect(created).toEqual({ id: "todo" });
    expect(calls[0]?.params).toEqual({
      commandId: "pstdio-planner.command.ticket-status.create",
      params: { label: "Todo" },
    });
  });

  test("throws the outcome reason when a command fails", async () => {
    const { host } = createHost(
      () => ({ outcome: { ok: false, status: "error", reason: "Ticket status exists." } }),
      "pstdio-planner",
    );
    const client = createWebviewClient<typeof commands, typeof settings>(host);

    await expect(client.commands["ticket-status.create"]({ label: "Todo" })).rejects.toThrow("Ticket status exists.");
  });

  test("prefers an explicit extensionId option over the host id", async () => {
    const { host, calls } = createHost(() => successOutcome({ statuses: [] }), "pstdio-planner");
    const client = createWebviewClient<typeof commands, typeof settings>(host, { extensionId: "test-extension" });

    await client.commands["ticket-status.read"]();

    expect(calls[0]?.params).toEqual({ commandId: "test-extension.command.ticket-status.read", params: undefined });
  });

  test("throws when no extension id is available", () => {
    const { host } = createHost(() => successOutcome(null));

    expect(() => createWebviewClient<typeof commands, typeof settings>(host)).toThrow(/extension id/i);
  });
});

describe("createWebviewClient artifacts", () => {
  const runArtifacts = defineArtifactMount({ id: "runs", path: "runs", label: "Runs" });

  test("lists artifact metadata for a declared mount", async () => {
    const files = [{ path: "a/chart.png", size: 10, mediaType: "image/png" }];
    const { host, calls } = createHost(() => files, "pstdio-playground");
    const client = createWebviewClient<typeof commands, typeof settings>(host);

    await expect(client.artifacts.list(runArtifacts, "a/")).resolves.toEqual(files);
    expect(calls).toEqual([{ method: "artifacts.read", params: { op: "list", mount: "runs", prefix: "a/" } }]);
  });

  test("reads text and mints image urls by mount id", async () => {
    const { host, calls } = createHost((call) => {
      const request = call.params as { op: string };
      return request.op === "readText" ? '{"ok":true}' : "/v1/extensions/webviews/cap/x/y/artifacts/1/p/runs/a.png";
    }, "pstdio-playground");
    const client = createWebviewClient<typeof commands, typeof settings>(host);

    await expect(client.artifacts.readText("runs", "a/summary.json")).resolves.toBe('{"ok":true}');
    await expect(client.artifacts.imageUrl(runArtifacts.ref, "a/chart.png")).resolves.toContain("/artifacts/");
    expect(calls).toEqual([
      { method: "artifacts.read", params: { op: "readText", mount: "runs", path: "a/summary.json" } },
      { method: "artifacts.read", params: { op: "imageUrl", mount: "runs", path: "a/chart.png" } },
    ]);
  });

  test("artifactsRead builds a mount-scoped declaration", () => {
    expect(artifactsRead(runArtifacts)).toBe("artifacts.read:runs");
    expect(artifactsRead(runArtifacts.ref)).toBe("artifacts.read:runs");
    expect(artifactsRead("reports")).toBe("artifacts.read:reports");
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
