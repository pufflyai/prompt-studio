import { expect, test } from "bun:test";
import { normalizePiMessages } from "./messages";

test("normalizes reasoning, tools, results and usage with stable message identities", () => {
  const messages = normalizePiMessages([
    { role: "user", content: "hello", timestamp: 1 },
    {
      role: "assistant",
      timestamp: 2,
      model: "test",
      provider: "local",
      content: [
        { type: "thinking", thinking: "Checking" },
        { type: "toolCall", id: "call-1", name: "read", arguments: { path: "a.txt" } },
      ],
      usage: { input: 10, output: 3, cacheRead: 2, cacheWrite: 1 },
    },
    {
      role: "toolResult",
      toolCallId: "call-1",
      toolName: "read",
      content: [{ type: "text", text: "file" }],
      isError: false,
    },
    { role: "assistant", timestamp: 4, content: [{ type: "text", text: "Done" }] },
  ]);
  expect(messages).toHaveLength(3);
  expect(messages[1]).toMatchObject({
    id: "pi-1",
    role: "assistant",
    modelId: "test",
    providerId: "local",
    parts: [
      { type: "reasoning", text: "Checking" },
      {
        type: "tool",
        callId: "call-1",
        tool: "read",
        status: "completed",
        state: { input: { path: "a.txt" }, output: "file" },
      },
      { type: "token_usage", inputTokens: 10, outputTokens: 3, cacheReadTokens: 2, cacheWriteTokens: 1 },
    ],
  });
  expect(messages[2]).toMatchObject({ id: "pi-2", parts: [{ type: "text", text: "Done" }] });
});

test("reports provider failures and failed tools", () => {
  const messages = normalizePiMessages([
    { role: "assistant", content: [{ type: "toolCall", id: "bad", name: "bash", arguments: {} }] },
    {
      role: "toolResult",
      toolCallId: "bad",
      toolName: "bash",
      isError: true,
      content: [{ type: "text", text: "failed" }],
    },
    { role: "assistant", content: [], stopReason: "error", errorMessage: "Provider unavailable" },
  ]);
  expect(messages[0].parts[0]).toMatchObject({ type: "tool", status: "failed" });
  expect(messages[1].parts).toContainEqual({ type: "error", errorType: "other", message: "Provider unavailable" });
});
