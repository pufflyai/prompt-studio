import { describe, expect, test } from "bun:test";
import {
  buildDashboardSessionsFromRows,
  resolveDashboardSessionView,
  resolveDashboardSessionViewForPlacement,
} from "./dashboard-sessions";

describe("resolveDashboardSessionView", () => {
  test("keeps an opened session addressable before synced rows arrive", () => {
    const view = resolveDashboardSessionView("session-created-from-draft");

    expect(view.id).toBe("session-created-from-draft");
    expect(view.sessionId).toBe("session-created-from-draft");
  });

  test("keeps workspace context on a new session draft placement", () => {
    const view = resolveDashboardSessionViewForPlacement({
      resource: {
        kind: "session-draft",
        uri: "dashboard-workbench://session-draft/workspace-1",
        id: "workspace-1",
        label: "New session",
        metadata: {
          workspaceId: "workspace-1",
          workspaceShorthand: "PS-307_A1",
          workspaceTitle: "PS-307_A1",
        },
      },
    });

    expect(view.sessionId).toBeUndefined();
    expect(view.workspaceId).toBe("workspace-1");
    expect(view.workspaceShorthand).toBe("PS-307_A1");
  });

  test("gives each new session draft resource its own draft storage key", () => {
    const first = resolveDashboardSessionViewForPlacement({
      resource: {
        kind: "session-draft",
        uri: "dashboard-workbench://session-draft/new-workspace-1-first",
        id: "new-workspace-1-first",
        label: "New session",
      },
    });
    const second = resolveDashboardSessionViewForPlacement({
      resource: {
        kind: "session-draft",
        uri: "dashboard-workbench://session-draft/new-workspace-1-second",
        id: "new-workspace-1-second",
        label: "New session",
      },
    });

    expect(first.draftKey).toBe("new-workspace-1-first");
    expect(second.draftKey).toBe("new-workspace-1-second");
  });

  test("exposes session status on the session resource", () => {
    const [session] = buildDashboardSessionsFromRows({
      files: [],
      projectRepos: [],
      repos: [],
      sessions: [
        {
          id: "session-1",
          project_id: "project-1",
          title: "Fix selector",
          status: "queued",
          updated_at: "2026-06-02T12:00:00.000Z",
        },
      ],
      workspaceSessions: [],
      workspaces: [],
    });

    expect(session?.resource.metadata?.status).toBe("queued");
  });
});
