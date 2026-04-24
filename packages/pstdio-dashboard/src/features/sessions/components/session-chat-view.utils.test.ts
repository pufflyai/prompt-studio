import { describe, expect, it } from "bun:test";
import type { SessionMessage } from "@pstdio/ui/chat-ui";
import { createPendingFollowUpState } from "./session-chat-state";
import {
  countCompletedEditActions,
  isSessionInterruptible,
  resolveNewSessionWorkspaceId,
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

  describe("isSessionInterruptible", () => {
    it("returns true for active session statuses", () => {
      expect(isSessionInterruptible("in_progress")).toBe(true);
      expect(isSessionInterruptible("awaiting_input")).toBe(true);
    });

    it("returns false for terminal and missing statuses", () => {
      expect(isSessionInterruptible("completed")).toBe(false);
      expect(isSessionInterruptible("failed")).toBe(false);
      expect(isSessionInterruptible("cancelled")).toBe(false);
      expect(isSessionInterruptible("disconnected")).toBe(false);
      expect(isSessionInterruptible(null)).toBe(false);
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

  describe("resolveNewSessionWorkspaceId", () => {
    it("returns the current workspace id for a new workspace-scoped draft", () => {
      expect(
        resolveNewSessionWorkspaceId({
          sessionId: null,
          workspaceId: undefined,
          newSessionWorkspaceId: "workspace-1",
        }),
      ).toBe("workspace-1");
    });

    it("prefers the explicit workspace id for existing sessions", () => {
      expect(
        resolveNewSessionWorkspaceId({
          sessionId: "session-1",
          workspaceId: "workspace-2",
          newSessionWorkspaceId: "workspace-1",
        }),
      ).toBe("workspace-2");
    });

    it("returns undefined for generic new sessions", () => {
      expect(
        resolveNewSessionWorkspaceId({
          sessionId: null,
          workspaceId: undefined,
          newSessionWorkspaceId: undefined,
        }),
      ).toBeUndefined();
    });

    it("does not reuse a pending workspace when caller does not provide workspace context", () => {
      expect(
        resolveNewSessionWorkspaceId({
          sessionId: null,
          workspaceId: undefined,
          newSessionWorkspaceId: undefined,
        }),
      ).toBeUndefined();
    });
  });
});
