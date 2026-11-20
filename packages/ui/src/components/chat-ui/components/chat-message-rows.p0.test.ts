import { describe, expect, test } from "bun:test";
import { buildChatMessageRows, getChatStickyRowIndex, hasChatRowGap } from "./chat-message-rows";
import type { SessionMessage } from "./message-types";

const message = (id: string, role: SessionMessage["role"] = "assistant"): SessionMessage => ({
  id,
  role,
  parts: [{ type: "text", text: id }],
});

describe("chat rendering rows", () => {
  test("gives every response its own row in a long turn", () => {
    const responses = Array.from({ length: 5_000 }, (_, index) => message(`response-${index}`));
    const rows = buildChatMessageRows([], [{ userMessage: message("user", "user"), responses }]);
    expect(rows).toHaveLength(5_001);
    expect(rows[0]).toMatchObject({ type: "user", key: "user", endIndex: 5_000 });
    expect(rows[2_500]).toMatchObject({
      type: "response",
      key: "response-2499",
      userIndex: 0,
      showAssistantActions: false,
    });
    expect(rows.at(-1)).toMatchObject({ key: "response-4999", showAssistantActions: true, isActiveTurn: true });
    expect(getChatStickyRowIndex(rows, 2_500)).toBe(0);
  });

  test("keeps leading responses and each turn's actions and sticky context", () => {
    const rows = buildChatMessageRows(
      [message("leading")],
      [
        { userMessage: message("first", "user"), responses: [message("reply"), message("tool", "tool")] },
        { userMessage: message("second", "user"), responses: [message("last")] },
        { userMessage: message("empty", "user"), responses: [] },
      ],
    );
    expect(rows.map((row) => row.key)).toEqual(["leading", "first", "reply", "tool", "second", "last", "empty"]);
    expect(rows[0]).toMatchObject({ userIndex: null, showAssistantActions: true, isActiveTurn: false });
    expect(rows[2]).toMatchObject({ showAssistantActions: false, isActiveTurn: false });
    expect(rows[5]).toMatchObject({ userIndex: 4, showAssistantActions: true, isActiveTurn: false });
    expect(rows[6]).toMatchObject({ endIndex: 6 });
    expect(getChatStickyRowIndex(rows, 0)).toBeNull();
    expect(getChatStickyRowIndex(rows, 3)).toBe(1);
    expect(getChatStickyRowIndex(rows, 4)).toBe(4);
    expect(getChatStickyRowIndex(rows, 6)).toBe(6);
    expect(rows.map((_row, index) => hasChatRowGap(rows, index))).toEqual([
      true,
      false,
      false,
      true,
      false,
      true,
      false,
    ]);
  });

  test("allows a conversation with only leading responses to stream", () => {
    const rows = buildChatMessageRows([message("first"), message("last")], []);
    expect(rows.at(-1)).toMatchObject({ showAssistantActions: true, isActiveTurn: true });
    expect(getChatStickyRowIndex(rows, 1)).toBeNull();
  });
});

test("counts repeated polling prompts and errors until the conversation moves on", () => {
  const poll = (id: string) => ({ ...message("Check for work", "user"), id });
  const error = (id: string, detail = "Limit reached"): SessionMessage => ({
    id,
    role: "system",
    parts: [{ type: "error", errorType: "other", message: detail }],
  });
  const rows = buildChatMessageRows(
    [],
    [
      { userMessage: poll("first"), responses: [error("a"), error("b")] },
      { userMessage: poll("retry"), responses: [error("c"), error("d"), error("changed", "Reset time changed")] },
      { userMessage: poll("success"), responses: [message("Work completed")] },
      { userMessage: poll("later"), responses: [error("e")] },
    ],
  );
  expect(rows.map((row) => row.key)).toEqual(["first", "a", "changed", "success", "Work completed", "later", "e"]);
  expect(rows[0]).toMatchObject({ messageIds: ["first", "retry"], endIndex: 2 });
  expect(rows[1]).toMatchObject({ messageIds: ["a", "b", "c", "d"], userIndex: 0 });
  expect(rows[6]).toMatchObject({ userIndex: 5, isActiveTurn: true });
});
