import { describe, expect, it } from "bun:test";
import { resolveWorkspacePageAutoOpenSession } from "./workspace-page-auto-open-session";

describe("resolveWorkspacePageAutoOpenSession", () => {
  it("opens the resolved session when the workspace route has no requested session", () => {
    expect(
      resolveWorkspacePageAutoOpenSession({
        isWorkspaceSessionsReady: true,
        requestedSessionId: undefined,
        activeSessionId: "session-1",
        hasAutoOpenedSession: false,
      }),
    ).toBe("session-1");
  });

  it("does not reopen while workspace sessions are still loading", () => {
    expect(
      resolveWorkspacePageAutoOpenSession({
        isWorkspaceSessionsReady: false,
        requestedSessionId: undefined,
        activeSessionId: "session-1",
        hasAutoOpenedSession: false,
      }),
    ).toBeNull();
  });

  it("does not reopen when the route already requested a session", () => {
    expect(
      resolveWorkspacePageAutoOpenSession({
        isWorkspaceSessionsReady: true,
        requestedSessionId: "session-1",
        activeSessionId: "session-1",
        hasAutoOpenedSession: false,
      }),
    ).toBeNull();
  });

  it("does not auto-open the same route again after the first open", () => {
    expect(
      resolveWorkspacePageAutoOpenSession({
        isWorkspaceSessionsReady: true,
        requestedSessionId: undefined,
        activeSessionId: "session-1",
        hasAutoOpenedSession: true,
      }),
    ).toBeNull();
  });
});
