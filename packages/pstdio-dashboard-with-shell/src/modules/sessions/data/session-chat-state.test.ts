import { describe, expect, test } from "bun:test";
import type { SessionMessage } from "@pstdio/ui/chat-ui";
import {
  createPendingFollowUpState,
  mergeMessagesWithPendingFollowUp,
  shouldClearPendingFollowUp,
} from "./session-chat-state";

const message = (id: string): SessionMessage => ({
  id,
  role: "assistant",
  parts: [{ type: "text", text: id }],
});

describe("mergeMessagesWithPendingFollowUp", () => {
  test("appends submitted prompt and assistant loading message", () => {
    const pending = createPendingFollowUpState({
      prompt: "Start the implementation",
      messageCount: 1,
      pendingId: "pending-1",
      sessionId: "session-1",
    });

    expect(mergeMessagesWithPendingFollowUp([message("existing")], pending)).toEqual([
      message("existing"),
      {
        id: "pending-1-user",
        role: "user",
        parts: [{ type: "text", text: "Start the implementation" }],
      },
      {
        id: "pending-1-assistant",
        role: "assistant",
        parts: [{ type: "loading" }],
      },
    ]);
  });
});

describe("shouldClearPendingFollowUp", () => {
  test("clears pending state once real messages advance past the submitted turn", () => {
    const pending = createPendingFollowUpState({
      prompt: "Follow up",
      messageCount: 1,
      pendingId: "pending-1",
      sessionId: "session-1",
    });

    expect(shouldClearPendingFollowUp(pending, [message("one")])).toBe(false);
    expect(shouldClearPendingFollowUp(pending, [message("one"), message("two")])).toBe(true);
  });
});
