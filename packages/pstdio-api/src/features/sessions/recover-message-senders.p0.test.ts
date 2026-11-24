import { expect, test } from "bun:test";
import type { SessionMessage } from "pstdio-api-contracts";
import { recoverMessageSenders } from "./recover-message-senders";

const sender = { type: "session" as const, id: "source", name: "Release checks" };
const attributed = { ...sender, requestId: "receiver:1" };
const request = {
  session_id: "receiver",
  queue_position: 1,
  prompt: "Check",
  sender_json: { ...sender, afterTurn: 1 },
  created_at: new Date(50).toISOString(),
  steering_delivery_json: null,
};
const prompt = (id: string, createdAt?: number): SessionMessage => ({
  id,
  role: "user",
  createdAt,
  parts: [{ type: "text", text: "Check" }],
});

test("matching native text and a saved turn do not prove which request submitted it", () => {
  const old = prompt("old", 10);
  const delivered = prompt("delivered", 100);
  expect(recoverMessageSenders([old, delivered], [request])).toEqual([old, delivered]);
  expect(recoverMessageSenders([old], [request])).toEqual([old]);
});

test("native prompts without timestamps stay unattributed without exact request evidence", () => {
  const old = prompt("old");
  const delivered = prompt("delivered");
  expect(recoverMessageSenders([old, delivered], [request])).toEqual([old, delivered]);
  expect(recoverMessageSenders([old], [request])).toEqual([old]);
});

test("a host checkpoint keeps its exact request identity", () => {
  const delivered = { ...prompt("delivered"), sender: attributed };
  expect(recoverMessageSenders([delivered], [request])).toEqual([delivered]);
});

test("uncertain steering restores attribution only for its confirmed delivery identity", () => {
  const old = prompt("old");
  const delivered = prompt("delivery");
  const held = { ...request, steering_delivery_json: { id: "delivery", runStartedAt: new Date(50).toISOString() } };
  expect(recoverMessageSenders([old, delivered], [held])).toEqual([old, { ...delivered, sender: attributed }]);
});
