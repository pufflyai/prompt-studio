import { describe, expect, test } from "bun:test";
import { getRecentUserPrompts, movePromptHistory } from "./chat-input-history";
import type { SessionMessage } from "./message-types";

describe("recent user prompts", () => {
  test("preserves text and part order while skipping other roles and empty entries", () => {
    const messages: SessionMessage[] = [
      {
        id: "1",
        role: "user",
        parts: [
          { type: "text", text: " first " },
          { type: "text", text: "second " },
        ],
      },
      { id: "2", role: "assistant", parts: [{ type: "text", text: "answer" }] },
      { id: "3", role: "user", parts: [{ type: "text", text: "  " }] },
      { id: "4", role: "user", parts: [{ type: "reasoning", text: "hidden" }] },
      ...(["system", "developer", "tool"] as const).map((role) => ({
        id: role,
        role,
        parts: [{ type: "text" as const, text: "excluded" }],
      })),
      { id: "5", role: "user", parts: [{ type: "text", text: "newest" }] },
    ];
    expect(getRecentUserPrompts(messages)).toEqual(["newest", " first second "]);
  });
  test("keeps the newest ten", () => {
    const messages: SessionMessage[] = Array.from({ length: 12 }, (_, i) => ({
      id: String(i),
      role: "user",
      parts: [{ type: "text", text: String(i) }],
    }));
    expect(getRecentUserPrompts(messages)).toEqual(["11", "10", "9", "8", "7", "6", "5", "4", "3", "2"]);
  });
});

describe("prompt history movement", () => {
  test("enters only from empty text with available prompts", () => {
    expect(movePromptHistory(null, "previous", "", 3)).toEqual({ index: 0 });
    expect(movePromptHistory(null, "previous", "draft", 3)).toBeNull();
    expect(movePromptHistory(null, "previous", "", 0)).toBeNull();
    expect(movePromptHistory(null, "next", "", 3)).toBeNull();
  });
  test("walks both ways, consumes the oldest boundary, and clears past newest", () => {
    expect(movePromptHistory(0, "previous", "new", 3)).toEqual({ index: 1 });
    expect(movePromptHistory(2, "previous", "old", 3)).toEqual({ index: 2 });
    expect(movePromptHistory(2, "next", "old", 3)).toEqual({ index: 1 });
    expect(movePromptHistory(0, "next", "new", 3)).toEqual({ index: null });
  });
});
