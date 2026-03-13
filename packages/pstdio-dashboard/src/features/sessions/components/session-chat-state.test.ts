import { describe, expect, it } from "bun:test";
import type { SessionMessage } from "@pstdio/ui/chat-ui";
import {
  createOptimisticFollowUpMessages,
  createPendingFollowUpState,
  mergeMessagesWithPendingFollowUp,
  shouldClearPendingFollowUp,
} from "./session-chat-state";

const message = (id: string, role: SessionMessage["role"] = "assistant"): SessionMessage => ({
  id,
  role,
  parts: [{ type: "text", text: id }],
});

describe("session chat optimistic state", () => {
  it("builds optimistic user and loading messages", () => {
    const pending = createPendingFollowUpState({
      prompt: "Follow up on the API",
      messageCount: 2,
      pendingId: "pending-1",
    });

    const optimistic = createOptimisticFollowUpMessages(pending);

    expect(optimistic).toEqual([
      {
        id: "pending-1-user",
        role: "user",
        parts: [{ type: "text", text: "Follow up on the API" }],
      },
      {
        id: "pending-1-assistant",
        role: "assistant",
        parts: [{ type: "loading" }],
      },
    ]);
  });

  it("merges server messages with pending follow-up", () => {
    const pending = createPendingFollowUpState({
      prompt: "Next steps?",
      messageCount: 1,
      pendingId: "pending-2",
    });

    const merged = mergeMessagesWithPendingFollowUp([message("m1", "user")], pending);

    expect(merged.map((entry) => entry.id)).toEqual(["m1", "pending-2-user", "pending-2-assistant"]);
  });

  it("clears pending state once stream progresses", () => {
    const pending = createPendingFollowUpState({
      prompt: "Another update",
      messageCount: 1,
      pendingId: "pending-3",
    });

    expect(shouldClearPendingFollowUp(pending, [message("m1")])).toBe(false);
    expect(shouldClearPendingFollowUp(pending, [message("m1"), message("m2")])).toBe(true);
  });
});
