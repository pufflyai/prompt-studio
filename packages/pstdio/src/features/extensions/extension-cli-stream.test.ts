import { expect, test } from "bun:test";
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
      async *stream(_command, input) {
        params = input.params;
        yield { type: "data", data: "one" };
        yield {
          type: "end",
          response: { commandId: "logs.tail", extensionId: "logs", outcome: { ok: true, status: "success", value: 1 } },
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
    async *stream(_command, _input, options) {
      process.emit("SIGINT");
      aborted = options!.signal!.aborted;
      options!.signal!.throwIfAborted();
      yield { type: "data", data: "unreachable" };
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
      async *stream() {
        yield await Promise.reject(new Error("Must execute normally"));
      },
    },
  });
  expect(status).toBe(0);
  expect(executed).toBe(true);
});
