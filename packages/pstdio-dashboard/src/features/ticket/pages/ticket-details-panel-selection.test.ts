import { describe, expect, it } from "bun:test";
import { navigateToCreatedWorkspace } from "../../workspaces/pages/workspace-page-helpers";
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

  it("navigates to the created workspace and clears selected session for ticket details empty-workspace flow", () => {
    const calls: unknown[] = [];
    const selected: Array<string | null> = [];

    navigateToCreatedWorkspace({
      navigate: ((input: unknown) => {
        calls.push(input);
      }) as never,
      setSelectedSessionId: (sessionId) => {
        selected.push(sessionId);
      },
      projectId: "project-1",
      ticketShorthand: "PS-72",
      workspaceShorthand: "PS-72_A9",
    });

    expect(selected).toEqual([null]);
    expect(calls).toEqual([
      {
        to: "/projects/$projectId/tickets/$ticketShorthand/workspaces/$workspaceShorthand",
        params: { projectId: "project-1", ticketShorthand: "PS-72", workspaceShorthand: "PS-72_A9" },
        search: {},
      },
    ]);
  });
});
