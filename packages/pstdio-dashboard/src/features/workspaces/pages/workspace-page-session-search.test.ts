import { describe, expect, it } from "bun:test";
import { resolveWorkspacePageSessionSearch } from "./workspace-page-session-search";

describe("resolveWorkspacePageSessionSearch", () => {
  it("preserves a requested session while workspace sessions are still loading", () => {
    const beforeHydration = resolveWorkspacePageSessionSearch({
      requestedSessionId: "session-2",
      activeSessionId: null,
      areWorkspaceSessionsReady: false,
    });

    const afterHydration = resolveWorkspacePageSessionSearch({
      requestedSessionId: "session-2",
      activeSessionId: "session-2",
      areWorkspaceSessionsReady: true,
    });

    expect(beforeHydration).toBeNull();
    expect(afterHydration).toBeNull();
  });

  it("normalizes to the resolved active session once data is ready", () => {
    const normalizedSearch = resolveWorkspacePageSessionSearch({
      requestedSessionId: "missing-session",
      activeSessionId: "session-1",
      areWorkspaceSessionsReady: true,
    });

    expect(normalizedSearch).toEqual({ sessionId: "session-1" });
  });

  it("removes the session search param when no active session exists", () => {
    const normalizedSearch = resolveWorkspacePageSessionSearch({
      requestedSessionId: "session-1",
      activeSessionId: null,
      areWorkspaceSessionsReady: true,
    });

    expect(normalizedSearch).toEqual({});
  });
});
