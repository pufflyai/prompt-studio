import { expect, test } from "bun:test";
import { buildChatTranscript } from "./chat-message-rows";
import { chatVisibilitySourceIds } from "./chat-visibility-sources";
import type { SessionMessage } from "./message-types";

test("a rendered combined tool row witnesses both source messages but not dropped reasoning", () => {
  const messages: SessionMessage[] = [
    { id: "text", role: "assistant", parts: [{ type: "text", text: "Previous answer" }] },
    { id: "tool-one", role: "assistant", parts: [{ type: "tool", tool: "read", status: "completed" }] },
    { id: "tool-two", role: "assistant", parts: [{ type: "tool", tool: "read", status: "completed" }] },
    { id: "reasoning", role: "assistant", parts: [{ type: "reasoning", text: "Private thinking" }] },
  ];
  const { rows } = buildChatTranscript(messages, false);
  const sourceIds = chatVisibilitySourceIds(messages, rows);
  expect(sourceIds(["tool-one"])).toEqual(["tool-one", "tool-two"]);
  expect(sourceIds(["text"])).toEqual(["text"]);
  expect(sourceIds([])).toEqual([]);
});

test("only reports activity sources from the part of a reply that was displayed", () => {
  const activity: SessionMessage[] = Array.from({ length: 8 }, (_, index) => ({
    id: `activity-${index}`,
    role: "assistant",
    parts: [{ type: "reasoning", text: `Review step ${index + 1}` }],
  }));
  const reply: SessionMessage = {
    id: "reply",
    role: "assistant",
    parts: [{ type: "text", text: "Review complete" }],
  };
  const { rows: streamingRows } = buildChatTranscript(activity, true);
  const messages = [...activity, reply];
  const { rows } = buildChatTranscript(messages, false);
  const sourceIds = chatVisibilitySourceIds(messages, rows);
  expect(rows[0].key).toBe(streamingRows[0].key);
  expect(sourceIds([rows[0].key])).toEqual(activity.slice(0, 4).map((message) => message.id));
  expect(sourceIds([rows.at(-1)!.key])).toEqual([reply.id]);
});
