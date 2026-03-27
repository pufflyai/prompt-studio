import { describe, expect, it } from "bun:test";
import type { SessionMessage } from "@pstdio/ui/chat-ui";
import { createPendingFollowUpState } from "./session-chat-state";
import { countCompletedEditActions, shouldResetPendingFollowUpForSession } from "./session-chat-view.utils";

const message = (id: string, parts: SessionMessage["parts"]): SessionMessage => ({
  id,
  role: "assistant",
  parts,
});

describe("session chat view utils", () => {
  it("counts only completed write and execute tool actions", () => {
    const messages = [
      message("m1", [
        { type: "tool", tool: "read-file", actionType: "read", status: "completed" },
        { type: "tool", tool: "write-file", actionType: "write", status: "completed" },
      ]),
      message("m2", [
        { type: "tool", tool: "run-tests", actionType: "execute", status: "completed" },
        { type: "tool", tool: "apply-patch", actionType: "write", status: "running" },
      ]),
    ];

    expect(countCompletedEditActions(messages)).toBe(2);
  });

  it("resets pending follow up when it belongs to another session", () => {
    const pending = createPendingFollowUpState({
      prompt: "Continue the fix",
      messageCount: 1,
      pendingId: "pending-1",
      sessionId: "session-1",
    });

    expect(shouldResetPendingFollowUpForSession(pending, "session-1")).toBe(false);
    expect(shouldResetPendingFollowUpForSession(pending, "session-2")).toBe(true);
    expect(shouldResetPendingFollowUpForSession(pending, null)).toBe(true);
    expect(shouldResetPendingFollowUpForSession(null, "session-2")).toBe(false);
  });
});
