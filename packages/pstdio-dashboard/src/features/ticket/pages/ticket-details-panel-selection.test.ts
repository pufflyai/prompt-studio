import { describe, expect, it } from "bun:test";
import { resolveWorkspaceSelection } from "../../workspaces/utils/workspace-selection";

describe("ticket details workspace selection", () => {
  it("keeps navigation search and session bubble selection in sync", () => {
    const selection = resolveWorkspaceSelection({
      sessions: [
        {
          id: "session-1",
          title: "Session 1",
          status: "running",
          agent: "codex",
          createdAt: "2026-04-10T10:00:00.000Z",
        },
      ],
    });

    expect(selection.search).toEqual({ sessionId: "session-1" });
    expect(selection.sessionIdToOpen).toBe("session-1");
    expect(selection.shouldClearSelection).toBe(false);
  });

  it("clears both navigation search and bubble selection when no sessions exist", () => {
    const selection = resolveWorkspaceSelection({ sessions: [] });

    expect(selection.search).toEqual({});
    expect(selection.sessionIdToOpen).toBeNull();
    expect(selection.shouldClearSelection).toBe(true);
  });
});
