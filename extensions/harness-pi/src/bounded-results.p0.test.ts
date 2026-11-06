import { expect, test } from "bun:test";
import { toolResultBytes } from "@pstdio/sdk/extensions";
import { normalizePiMessages, retainPiToolResult } from "./messages";

test("Pi failed results share one aggregate allowance across output and error details", () => {
  const text = `HEAD${"x".repeat(76_000_000)}TAIL`;
  const messages = normalizePiMessages([
    { role: "assistant", content: [{ type: "toolCall", id: "call", name: "bash", arguments: {} }] },
    { role: "toolResult", toolCallId: "call", isError: true, content: [{ type: "text", text }] },
    { role: "assistant", content: "later" },
  ]);
  const part = messages[0].parts[0];
  if (part.type !== "tool") throw new Error("Expected tool");
  expect(part.status).toBe("failed");
  expect(toolResultBytes(part)).toBeLessThanOrEqual(262144);
  expect(part.state?.output).toContain("HEAD");
  expect(part.state?.output).toContain("TAIL");
  expect(messages[1].parts).toEqual([{ type: "text", text: "later" }]);
});

test("Pi edit-tool details share the result allowance before native retention", () => {
  const retained = retainPiToolResult({
    role: "toolResult",
    toolCallId: "call",
    content: "Edited file",
    details: { diff: "x".repeat(1000000), patch: "y".repeat(1000000), firstChangedLine: 1 },
  });
  expect(Buffer.byteLength(JSON.stringify(retained))).toBeLessThan(263000);
  expect(retained.resultSummary?.omittedBytes).toBeGreaterThan(1000000);
});
