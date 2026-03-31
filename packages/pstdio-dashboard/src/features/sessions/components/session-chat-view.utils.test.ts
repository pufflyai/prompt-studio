import { describe, expect, it } from "bun:test";
import type { SessionMessage } from "@pstdio/ui/chat-ui";
import { createPendingFollowUpState } from "./session-chat-state";
import {
  countCompletedEditActions,
  shouldReconnectForExternalResume,
  shouldResetPendingFollowUpForSession,
} from "./session-chat-view.utils";

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

  describe("shouldReconnectForExternalResume", () => {
    it("returns true when transitioning from failed to in_progress while not streaming", () => {
      expect(shouldReconnectForExternalResume("failed", "in_progress", false)).toBe(true);
    });

    it("returns true when transitioning from completed to in_progress while not streaming", () => {
      expect(shouldReconnectForExternalResume("completed", "in_progress", false)).toBe(true);
    });

    it("returns true when transitioning from cancelled to in_progress while not streaming", () => {
      expect(shouldReconnectForExternalResume("cancelled", "in_progress", false)).toBe(true);
    });

    it("returns false on initial mount (prevStatus is null)", () => {
      expect(shouldReconnectForExternalResume(null, "in_progress", false)).toBe(false);
    });

    it("returns false when already streaming (dashboard-initiated reconnect)", () => {
      expect(shouldReconnectForExternalResume("failed", "in_progress", true)).toBe(false);
    });

    it("returns false when transitioning to a non-in_progress status", () => {
      expect(shouldReconnectForExternalResume("in_progress", "failed", false)).toBe(false);
    });

    it("returns false when staying in the same terminal status", () => {
      expect(shouldReconnectForExternalResume("failed", "failed", false)).toBe(false);
    });
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
