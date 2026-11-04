import { expect, test } from "bun:test";
import type { SessionMessage } from "pstdio-api-contracts";
import { toolResultBytes } from "pstdio-api-contracts";
import { createEventStore } from "pstdio-api-runtime-host";
import { createSessionConversation } from "./session-conversation";

const message = (output: unknown): SessionMessage => ({
  id: "tool",
  role: "assistant",
  parts: [{ type: "tool", tool: "shell", state: { output } }],
});
const bytes = (messages: SessionMessage[]) => {
  const part = messages[0].parts[0];
  if (part.type !== "tool") throw new Error("Expected tool");
  return toolResultBytes(part);
};

test("initial checkpoints, root replacements and individual patches are bounded before retention and delivery", () => {
  const raw = message("x".repeat(1000000));
  const events = createEventStore();
  const conversation = createSessionConversation(events, [raw]);
  expect(bytes(conversation.getMessages())).toBeLessThanOrEqual(262144);
  for (const patch of [
    { op: "replace" as const, path: "/messages", value: [raw] },
    { op: "replace" as const, path: "/messages/0", value: raw },
  ]) {
    conversation.push(patch);
    expect(bytes(conversation.getMessages())).toBeLessThanOrEqual(262144);
    expect(JSON.stringify(events.getHistory().at(-1)).length).toBeLessThan(263000);
  }
});
