import { describe, expect, it } from "bun:test";
import {
  isStickyUserMessageCollapsible,
  STICKY_USER_MESSAGE_COLLAPSE_TEXT_THRESHOLD,
} from "./chat-panel-sticky-user-message";
import type { SessionMessage } from "./message-types";

const createUserMessage = (text: string): SessionMessage => ({
  id: "message-1",
  role: "user",
  parts: [{ type: "text", text }],
});

describe("isStickyUserMessageCollapsible", () => {
  it("returns false for user messages below the collapse threshold", () => {
    const message = createUserMessage("x".repeat(STICKY_USER_MESSAGE_COLLAPSE_TEXT_THRESHOLD));

    expect(isStickyUserMessageCollapsible(message)).toBe(false);
  });

  it("returns true for long user messages", () => {
    const message = createUserMessage("x".repeat(STICKY_USER_MESSAGE_COLLAPSE_TEXT_THRESHOLD + 1));

    expect(isStickyUserMessageCollapsible(message)).toBe(true);
  });

  it("returns false for non-user messages", () => {
    const message: SessionMessage = {
      id: "message-2",
      role: "assistant",
      parts: [{ type: "text", text: "x".repeat(STICKY_USER_MESSAGE_COLLAPSE_TEXT_THRESHOLD + 200) }],
    };

    expect(isStickyUserMessageCollapsible(message)).toBe(false);
  });
});
