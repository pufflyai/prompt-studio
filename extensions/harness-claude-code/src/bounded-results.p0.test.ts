import { expect, test } from "bun:test";
import {
  normalizeMessageResults,
  projectToolResultRecovery,
  type SessionMessage,
  toolResultBytes,
} from "@pstdio/sdk/extensions";
import { recoverClaudeMessages } from "./history-reconciliation";
import { toolResultPart } from "./message-parts";

const message = (output: unknown): SessionMessage => ({
  id: "tool",
  role: "assistant",
  parts: [{ type: "tool", tool: "Bash", callId: "call", status: "completed", state: { output } }],
});

test("Claude bounds rich returned output before its accumulator retains it", () => {
  const text = `HEAD${"x".repeat(76_000_000)}TAIL`;
  const part = toolResultPart("Bash", { type: "tool_result", tool_use_id: "call", content: text }, { stdout: text });
  expect(toolResultBytes(part)).toBeLessThanOrEqual(262144);
  expect(part.state?.output).toContain("HEAD");
  expect(part.state?.output).toContain("TAIL");
});

test("legacy and shortened Claude checkpoints recover native-only tails with returnDisplay equivalence", () => {
  const text = `HEAD${"x".repeat(1000000)}TAIL`;
  const legacy = message({ stdout: text, returnDisplay: text });
  const native = [
    message(text),
    { id: "later", role: "assistant" as const, parts: [{ type: "text" as const, text: "later" }] },
  ];
  for (const known of [legacy, normalizeMessageResults(legacy)]) {
    const input = projectToolResultRecovery([known], native);
    const recovered = recoverClaudeMessages(input);
    expect(recovered.kind).toBe("recovered");
    if (recovered.kind === "recovered") expect(recovered.messages.at(-1)?.id).toBe("later");
  }
});

test("different original Claude results with identical visible ends still conflict", () => {
  const prefix = "HEAD".repeat(100000);
  const suffix = "TAIL".repeat(100000);
  const input = projectToolResultRecovery([message(`${prefix}x${suffix}`)], [message(`${prefix}y${suffix}`)]);
  expect(recoverClaudeMessages(input)).toEqual({ kind: "conflict", category: "conflicting_tool_output" });
});
