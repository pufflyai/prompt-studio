import { describe, expect, it } from "bun:test";
import { getMessageCopyText, getMessageTimestampLabel } from "./message-action-panel";
import type { SessionMessage } from "./message-types";

describe("message action panel", () => {
  it("copies visible assistant message text", () => {
    const message: SessionMessage = {
      id: "assistant-copy",
      role: "assistant",
      parts: [
        { type: "reasoning", text: "Need to inspect the call site." },
        { type: "text", text: "Updated the chat panel." },
        { type: "tool", tool: "bash" },
      ],
    };

    expect(getMessageCopyText(message)).toBe("Updated the chat panel.");
  });

  it("does not treat reasoning-only messages as content", () => {
    const message: SessionMessage = {
      id: "assistant-thinking",
      role: "assistant",
      parts: [{ type: "reasoning", text: "Need to inspect the call site." }],
    };

    expect(getMessageCopyText(message)).toBe("");
  });

  it("formats message timestamps when present", () => {
    const message: SessionMessage = {
      id: "assistant-timestamp",
      role: "assistant",
      createdAt: Date.UTC(2026, 4, 10, 14, 35),
      parts: [{ type: "text", text: "Timestamped response." }],
    };

    expect(getMessageTimestampLabel(message, "en-US", "UTC")).toBe("2:35 PM");
  });
});
