import { describe, expect, it } from "bun:test";
import {
  resolveWorkspacePageRouteSessionSelection,
  resolveWorkspacePageSessionSearch,
} from "./workspace-page-session-search";

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
      requestedTab: "changes",
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

    expect(normalizedSearch).toEqual({ sessionId: "session-1", tab: "changes" });
  });

  it("removes the session search param when no active session exists", () => {
    const normalizedSearch = resolveWorkspacePageSessionSearch({
      requestedSessionId: "session-1",
      activeSessionId: null,
      areWorkspaceSessionsReady: true,
    });

    expect(normalizedSearch).toEqual({ tab: "changes" });
  });

  it("preserves the selected tab when normalizing session search", () => {
    const normalizedSearch = resolveWorkspacePageSessionSearch({
      requestedSessionId: "missing-session",
      activeSessionId: "session-1",
      requestedTab: "checks",
      areWorkspaceSessionsReady: true,
    });

    expect(normalizedSearch).toEqual({ sessionId: "session-1", tab: "checks" });
  });

  it("defaults tab to changes when none is requested", () => {
    const normalizedSearch = resolveWorkspacePageSessionSearch({
      requestedSessionId: "missing-session",
      activeSessionId: "session-1",
      areWorkspaceSessionsReady: true,
    });

    expect(normalizedSearch).toEqual({ sessionId: "session-1", tab: "changes" });
  });

  it("adds default tab when both requested and active session are empty", () => {
    const normalizedSearch = resolveWorkspacePageSessionSearch({
      requestedSessionId: undefined,
      activeSessionId: null,
      areWorkspaceSessionsReady: true,
    });

    expect(normalizedSearch).toEqual({ tab: "changes" });
  });

  it("normalizes missing tab even when requested session is already active", () => {
    const normalizedSearch = resolveWorkspacePageSessionSearch({
      requestedSessionId: "session-1",
      activeSessionId: "session-1",
      requestedTab: undefined,
      areWorkspaceSessionsReady: true,
    });

    expect(normalizedSearch).toEqual({ sessionId: "session-1", tab: "changes" });
  });

  it("normalizes invalid tab even when requested session is already active", () => {
    const normalizedSearch = resolveWorkspacePageSessionSearch({
      requestedSessionId: "session-1",
      activeSessionId: "session-1",
      requestedTab: "invalid",
      areWorkspaceSessionsReady: true,
    });

    expect(normalizedSearch).toEqual({ sessionId: "session-1", tab: "changes" });
  });
});

describe("resolveWorkspacePageRouteSessionSelection", () => {
  it("syncs the route-selected session into chat state when workspace sessions are ready", () => {
    const selectedSessionId = resolveWorkspacePageRouteSessionSelection({
      requestedSessionId: "session-2",
      activeSessionId: "session-2",
      areWorkspaceSessionsReady: true,
      lastSyncedSessionId: null,
    });

    expect(selectedSessionId).toBe("session-2");
  });

  it("does not resync the same route session after the user changes chat state", () => {
    const selectedSessionId = resolveWorkspacePageRouteSessionSelection({
      requestedSessionId: "session-2",
      activeSessionId: "session-2",
      areWorkspaceSessionsReady: true,
      lastSyncedSessionId: "session-2",
    });

    expect(selectedSessionId).toBeNull();
  });
});
