import { expect, test } from "bun:test";
import { buildChatMessageRows } from "./chat-message-rows";
import { getOutlineEntries } from "./chat-outline-entries";
import type { SessionMessage } from "./message-types";

const user = (id: string): SessionMessage => ({ id, role: "user", parts: [{ type: "text", text: id }] });
test("outline appears at three visible messages and targets each prompt's real row", () => {
  const reply: SessionMessage = { ...user("Answer"), role: "assistant" };
  const first = { userMessage: user("First"), responses: [reply] };
  expect(getOutlineEntries(buildChatMessageRows([], [first]))).toEqual([]);
  const rows = buildChatMessageRows([], [first, { userMessage: user("Second"), responses: [] }]);
  expect(getOutlineEntries(rows)).toEqual([
    { id: "First", index: 0, prompt: "First", reply: "Answer" },
    { id: "Second", index: 2, prompt: "Second", reply: "" },
  ]);
});
