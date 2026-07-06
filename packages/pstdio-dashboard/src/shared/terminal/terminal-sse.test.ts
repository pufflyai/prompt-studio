import { describe, expect, test } from "bun:test";
import { createTerminalSseParser } from "./terminal-sse";

const encode = (text: string) => btoa(text);

describe("createTerminalSseParser", () => {
  test("parses data and exit events from a complete stream", () => {
    const parser = createTerminalSseParser();

    const events = parser.push(
      `event: data\ndata: {"chunk":"${encode("hello")}"}\n\nevent: exit\ndata: {"code":0,"signal":null}\n\n`,
    );

    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({ kind: "data", chunk: new TextEncoder().encode("hello") });
    expect(events[1]).toEqual({ kind: "exit", code: 0, signal: null });
  });

  test("buffers blocks split across pushes", () => {
    const parser = createTerminalSseParser();

    expect(parser.push('event: data\ndata: {"chunk":"')).toEqual([]);
    const events = parser.push(`${encode("hi")}"}\n\n`);

    expect(events).toEqual([{ kind: "data", chunk: new TextEncoder().encode("hi") }]);
  });

  test("surfaces error events", () => {
    const parser = createTerminalSseParser();

    const events = parser.push(`event: error\ndata: {"message":"boom"}\n\n`);

    expect(events).toEqual([{ kind: "error", message: "boom" }]);
  });
});
