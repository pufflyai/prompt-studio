import { describe, expect, test } from "bun:test";
import type { SessionMessage } from "@pstdio/ui/chat-ui";
import { resolveSessionConversationSnapshot } from "./session-conversation-state";

const message = (id: string): SessionMessage => ({
  id,
  role: "assistant",
  parts: [{ type: "text", text: id }],
});

describe("resolveSessionConversationSnapshot", () => {
  test("clears stale messages while the requested session is hydrating", () => {
    const snapshot = resolveSessionConversationSnapshot("session_2", {
      sessionId: "session_1",
      messages: [message("from-session-1")],
      isLoadingMessages: false,
      isStreaming: true,
      approvalRequest: null,
    });

    expect(snapshot).toEqual({
      messages: [],
      isLoadingMessages: true,
      isStreaming: false,
      approvalRequest: null,
    });
  });

  test("returns current messages once the requested session is loaded", () => {
    const messages = [message("from-session-2")];

    expect(
      resolveSessionConversationSnapshot("session_2", {
        sessionId: "session_2",
        messages,
        isLoadingMessages: false,
        isStreaming: false,
        approvalRequest: null,
      }),
    ).toEqual({
      messages,
      isLoadingMessages: false,
      isStreaming: false,
      approvalRequest: null,
    });
  });
});
