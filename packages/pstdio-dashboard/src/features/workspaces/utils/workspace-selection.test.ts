import { describe, expect, it } from "bun:test";
import { resolveWorkspaceSelection } from "./workspace-selection";

describe("resolveWorkspaceSelection", () => {
  it("opens the first session bubble when selecting a workspace while the bubble is closed", () => {
    const selection = resolveWorkspaceSelection({
      sessions: [
        {
          id: "session-1",
          title: "Session 1",
          status: "completed",
          agent: null,
          createdAt: "2026-04-10T10:00:00.000Z",
        },
      ],
    });

    expect(selection).toEqual({
      search: { sessionId: "session-1" },
      sessionIdToOpen: "session-1",
      shouldClearSelection: false,
    });
  });

  it("does not request opening a bubble when the selected workspace has no sessions", () => {
    const selection = resolveWorkspaceSelection({
      sessions: [],
    });

    expect(selection).toEqual({
      search: {},
      sessionIdToOpen: null,
      shouldClearSelection: true,
    });
  });
});
