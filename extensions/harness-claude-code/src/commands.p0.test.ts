import { expect, test } from "bun:test";
import { claudePrompt, visibleClaudePrompt } from "./literal-prompt";
import { normalizeClaudeCodeStream } from "./normalize-stream";

test("literal slash input preserves its text without invoking CLI commands", () => {
  const literal = claudePrompt("/goal is an example", false);
  expect(literal.startsWith("/")).toBe(false);
  expect(visibleClaudePrompt(literal)).toBe("/goal is an example");
  expect(claudePrompt("/goal task", true)).toBe("/goal task");
});
test("compaction shows one terminal outcome instead of replaying an earlier reply", async () => {
  async function* events() {
    yield {
      type: "stdout" as const,
      data: JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "earlier reply" }] } }),
    };
    yield {
      type: "stdout" as const,
      data: JSON.stringify({ type: "result", local_command: "compact", result: "", usage: {} }),
    };
  }
  const messages = [];
  for await (const m of normalizeClaudeCodeStream(events(), { compact: true })) messages.push(m);
  expect(messages.flatMap((m) => m.parts).filter((p) => p.type === "text")).toHaveLength(1);
  expect(messages.flatMap((m) => m.parts).some((p) => p.type === "text" && p.text === "earlier reply")).toBe(false);
});

import { buildStartSessionArgs } from "./spawn";

test("planning uses the native permission mode and returning to default restores bypass", () => {
  expect(buildStartSessionArgs({ params: { permission_mode: "plan" } })).toContain("plan");
  expect(buildStartSessionArgs({ params: { permission_mode: "bypassPermissions" } })).toContain("bypassPermissions");
});
test("local native command outcomes appear in the conversation without invented modes", async () => {
  async function* events() {
    yield {
      type: "stdout" as const,
      data: JSON.stringify({ type: "result", local_command: "goal", result: "No goal set", usage: {} }),
    };
  }
  const messages = [];
  for await (const message of normalizeClaudeCodeStream(events())) messages.push(message);
  expect(messages.flatMap((m) => m.parts).some((p) => p.type === "text" && p.text === "No goal set")).toBe(true);
});
