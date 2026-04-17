import { describe, expect, it } from "bun:test";
import { resolveWorkspacePageSessionSearch } from "./workspace-page-session-search";
import { validateWorkspaceRouteSearch } from "./workspace-route-search";

describe("validateWorkspaceRouteSearch", () => {
  it("preserves raw tab values for workspace page normalization", () => {
    expect(validateWorkspaceRouteSearch({ sessionId: "session-1", tab: "checks" })).toEqual({
      sessionId: "session-1",
      tab: "checks",
    });

    expect(validateWorkspaceRouteSearch({ sessionId: "session-1", tab: "invalid" })).toEqual({
      sessionId: "session-1",
      tab: "invalid",
    });

    expect(validateWorkspaceRouteSearch({ sessionId: "session-1" })).toEqual({
      sessionId: "session-1",
      tab: undefined,
    });
  });
});

describe("workspace route tab canonicalization", () => {
  it("writes canonical tab when route search has invalid tab", () => {
    const validated = validateWorkspaceRouteSearch({ sessionId: "session-1", tab: "invalid" });
    const normalized = resolveWorkspacePageSessionSearch({
      requestedSessionId: validated.sessionId,
      requestedTab: validated.tab,
      activeSessionId: "session-1",
      areWorkspaceSessionsReady: true,
    });

    expect(normalized).toEqual({ sessionId: "session-1", tab: "changes" });
  });

  it("writes canonical tab when route search has no tab", () => {
    const validated = validateWorkspaceRouteSearch({ sessionId: "session-1" });
    const normalized = resolveWorkspacePageSessionSearch({
      requestedSessionId: validated.sessionId,
      requestedTab: validated.tab,
      activeSessionId: "session-1",
      areWorkspaceSessionsReady: true,
    });

    expect(normalized).toEqual({ sessionId: "session-1", tab: "changes" });
  });
});
