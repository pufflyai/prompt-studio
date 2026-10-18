import { expect, test } from "bun:test";
import type { CommandOutcome } from "@pstdio/sdk/extensions";
import { dispatchExtensionCliCommand } from "./extension-cli-router";

test("stream flag prints data and final outcome as NDJSON", async () => {
  const lines: string[] = [];
  let params: unknown;
  const status = await dispatchExtensionCliCommand({
    rawArgs: ["logs", "tail", "--stream", "--count", "2"],
    deps: {
      cwd: () => "/test",
      resolveProjectId: () => ({ projectId: "p1", root: null }),
      listCommands: async () => ({
        diagnostics: [],
        commands: [
          {
            id: "logs.tail",
            extensionId: "logs",
            title: "Tail",
            cliPath: "logs tail",
            params: { count: { type: "number" } },
          },
        ],
      }),
      log: (line) => lines.push(line),
      streamCommand(projectId, commandId, input) {
        expect(projectId).toBe("p1");
        expect(commandId).toBe("logs.tail");
        params = input?.params;
        return {
          async *[Symbol.asyncIterator]() {
            yield "one";
          },
          outcome: Promise.resolve({ ok: true, status: "success", value: 1 } satisfies CommandOutcome),
          result: Promise.resolve(1),
          cancel: async () => {},
        };
      },
    },
  });
  expect(status).toBe(0);
  expect(params).toEqual({ count: 2 });
  expect(lines.map((line) => JSON.parse(line))).toEqual([
    { type: "data", data: "one" },
    { type: "end", outcome: { ok: true, status: "success", value: 1 } },
  ]);
});

test("SIGINT aborts the command stream and exits with code 130", async () => {
  const { printExtensionCommandStream } = await import("./extension-cli-stream");
  const lines: string[] = [];
  let aborted = false;
  const exit = await printExtensionCommandStream({
    commandId: "tail",
    request: { projectId: "p1" },
    log: (line) => lines.push(line),
    streamCommand(_project, _command, _input, options) {
      return {
        async *[Symbol.asyncIterator]() {
          process.emit("SIGINT");
          aborted = options!.signal!.aborted;
          yield* [];
        },
        outcome: Promise.resolve({
          ok: false,
          status: "error",
          code: "command_stream_cancelled",
          reason: "Cancelled",
        } satisfies CommandOutcome),
        result: Promise.resolve(undefined),
        cancel: async () => {},
      };
    },
  });
  expect(exit).toBe(130);
  expect(aborted).toBe(true);
  expect(lines.map((line) => JSON.parse(line))).toMatchObject([
    { type: "end", outcome: { code: "command_stream_cancelled" } },
  ]);
});

test("a parameter value equal to --stream remains an ordinary command argument", async () => {
  let executed = false;
  const status = await dispatchExtensionCliCommand({
    rawArgs: ["logs", "echo", "--text", "--stream"],
    deps: {
      cwd: () => "/test",
      resolveProjectId: () => ({ projectId: "p1", root: null }),
      listCommands: async () => ({
        diagnostics: [],
        commands: [
          {
            id: "logs.echo",
            extensionId: "logs",
            title: "Echo",
            cliPath: "logs echo",
            params: { text: { type: "text" } },
          },
        ],
      }),
      log: () => {},
      execute: async (_command, input) => {
        expect(input.params).toEqual({ text: "--stream" });
        executed = true;
        return {
          commandId: "logs.echo",
          extensionId: "logs",
          outcome: { ok: true, status: "success", value: "--stream" },
        };
      },
      streamCommand() {
        throw new Error("Must execute normally");
      },
    },
  });
  expect(status).toBe(0);
  expect(executed).toBe(true);
});

test("CLI streaming keeps structured rejection details", async () => {
  const { printExtensionCommandStream } = await import("./extension-cli-stream");
  const lines: string[] = [];
  const outcome = {
    ok: false,
    status: "rejected",
    code: "stale_revision",
    reason: "Changed",
    data: { revision: 2 },
    cause: { source: "storage" },
    notices: [{ type: "warning", message: "Reload" }],
    diagnostics: [{ code: "conflict", message: "Changed", severity: "warning" }],
  } satisfies CommandOutcome;
  expect(
    await printExtensionCommandStream({
      commandId: "save",
      request: { projectId: "p1" },
      streamCommand: () => ({
        async *[Symbol.asyncIterator]() {
          yield* [];
        },
        outcome: Promise.resolve(outcome),
        result: Promise.resolve(undefined),
        cancel: async () => {},
      }),
      log: (line) => lines.push(line),
    }),
  ).toBe(1);
  expect(lines.map((line) => JSON.parse(line))).toEqual([{ type: "end", outcome }]);
});
