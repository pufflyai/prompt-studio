import { describe, expect, test } from "bun:test";
import { buildChatMessageRows, getChatStickyRowIndex, hasChatRowGap } from "./chat-message-rows";
import type { SessionMessage } from "./message-types";

const message = (id: string, role: SessionMessage["role"] = "assistant"): SessionMessage => ({
  id,
  role,
  parts: [{ type: "text", text: id }],
});

const error = (id: string, detail = "Limit reached"): SessionMessage => ({
  id,
  role: "system",
  parts: [{ type: "error", errorType: "other", message: detail }],
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

test("groups repeat prompts only when they display the same sender", () => {
  const poll = (id: string, sender?: SessionMessage["sender"]): SessionMessage => ({
    ...message("Check for work", "user"),
    id,
    sender: sender && { ...sender, requestId: id },
  });
  const agent = { type: "session", id: "watcher-1", name: "Watcher" } as const;
  const otherAgent = { ...agent, id: "watcher-2" };
  const user = { ...otherAgent, type: "user" } as const;
  const renamed = { ...user, name: "Another name" };
  const prompts = [
    poll("first", agent),
    poll("retry", agent),
    poll("second", otherAgent),
    poll("user", user),
    poll("renamed", renamed),
    poll("legacy"),
  ];
  const rows = buildChatMessageRows(
    [],
    prompts.map((userMessage) => ({ userMessage, responses: [] })),
  );
  expect(rows.map((row) => row.messageIds)).toEqual([
    ["first", "retry"],
    ["second"],
    ["user"],
    ["renamed"],
    ["legacy"],
  ]);
});

test("keeps a recurring error separate when another error intervenes", () => {
  const rows = buildChatMessageRows(
    [error("first"), error("duplicate"), error("changed", "Reset time changed"), error("latest")],
    [],
  );
  expect(rows.map((row) => row.messageIds)).toEqual([["first", "duplicate"], ["changed"], ["latest"]]);
});

test("bounds long assistant rows while retaining the original reply for message actions", () => {
  const reply: SessionMessage = {
    ...message("reply"),
    parts: [
      ...Array.from({ length: 200 }, (_, index) => ({
        type: "reasoning" as const,
        text: `Review step ${index + 1}`,
      })),
      { type: "text", text: "The review is complete." },
    ],
  };
  const rows = buildChatMessageRows([], [{ userMessage: message("user", "user"), responses: [reply] }]);
  expect(rows.length).toBeGreaterThan(2);
  const responses = rows.filter((row) => row.type === "response");
  expect(responses.flatMap((row) => row.message.parts.slice(row.partRange?.start, row.partRange?.end))).toEqual(
    reply.parts,
  );
  expect(
    Math.max(...responses.map((row) => row.message.parts.slice(row.partRange?.start, row.partRange?.end).length)),
  ).toBeLessThanOrEqual(4);
  expect(responses.filter((row) => row.showAssistantActions).map((row) => row.message)).toEqual([reply]);
  expect(responses.every((row) => row.userIndex === 0)).toBe(true);
});

test("preserves existing virtual rows when streaming past part boundaries", () => {
  const parts = Array.from({ length: 9 }, (_, index) => ({ type: "text" as const, text: `Part ${index + 1}` }));
  const keys = (count: number) =>
    buildChatMessageRows([{ ...message("reply"), parts: parts.slice(0, count) }], [], true).map((row) => row.key);
  expect(keys(5).slice(0, 1)).toEqual(keys(4));
  expect(keys(9).slice(0, 2)).toEqual(keys(8));
});
