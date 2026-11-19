import { expect, test } from "bun:test";
import { chatVisibilitySourceIds } from "./chat-visibility-sources";
import { normalizeChatMessagesForDisplay, type SessionMessage } from "./message-types";

test("a rendered combined tool row witnesses both source messages but not dropped reasoning", () => {
  const messages: SessionMessage[] = [
    { id: "text", role: "assistant", parts: [{ type: "text", text: "Previous answer" }] },
    { id: "tool-one", role: "assistant", parts: [{ type: "tool", tool: "read", status: "completed" }] },
    { id: "tool-two", role: "assistant", parts: [{ type: "tool", tool: "read", status: "completed" }] },
    { id: "reasoning", role: "assistant", parts: [{ type: "reasoning", text: "Private thinking" }] },
  ];
  const displayed = normalizeChatMessagesForDisplay(messages);
  const sourceIds = chatVisibilitySourceIds(messages, displayed);
  expect(sourceIds(["tool-one"])).toEqual(["tool-one", "tool-two"]);
  expect(sourceIds(["text"])).toEqual(["text"]);
  expect(sourceIds([])).toEqual([]);
});
