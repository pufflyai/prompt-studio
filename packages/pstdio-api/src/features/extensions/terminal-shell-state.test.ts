import { expect, test } from "bun:test";
import { createTerminalShellState } from "./terminal-shell-state";

const marker = (state: string) => `\x1b]633;PSTDIO=test-session;${state}\x07`;

test("tracks split shell markers without changing output bytes", () => {
  const state = createTerminalShellState("test-session");
  const bytes = Buffer.from(`before 😀${marker("prompt")}after${marker("busy")}end`);
  const output = [];
  for (const byte of bytes) output.push(state.onData(new Uint8Array([byte])));
  expect(Buffer.concat(output).toString()).toBe("before 😀afterend");
  expect(state.atPrompt()).toBe(false);
  expect(state.onData(Buffer.from(marker("prompt")))).toHaveLength(0);
  expect(state.atPrompt()).toBe(true);
  state.onInput("echo hello");
  expect(state.atPrompt()).toBe(true);
  state.onInput(new Uint8Array([13]));
  expect(state.atPrompt()).toBe(false);
});

test("preserves unrelated control sequences and malformed markers", () => {
  const state = createTerminalShellState("test-session");
  const output = `\x1b]0;title\x07${marker("other")}${marker("prompt").replace("test-session", "other-session")}done`;
  expect(Buffer.from(state.onData(Buffer.from(output))).toString()).toBe(output);
  expect(state.atPrompt()).toBe(false);
});
