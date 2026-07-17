import { describe, expect, test } from "bun:test";
import { createDashboardResource, dashboardResources } from "@/shared/app/resources";
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

  test("exposes session status on the session resource", () => {
    const [session] = buildDashboardSessionsFromRows({
      files: [],
      sessions: [
        {
          id: "session-1",
          project_id: "project-1",
          title: "Fix selector",
          status: "queued",
          updated_at: "2026-06-02T12:00:00.000Z",
        },
      ],
      tickets: [],
      workspaceSessions: [],
      workspaces: [],
    });

    expect(session?.resource.metadata?.status).toBe("queued");
  });

  test("parents linked sessions under their canonical workspace and standalone sessions under the sessions root", () => {
    const sessions = buildDashboardSessionsFromRows({
      files: [],
      sessions: [
        {
          id: "session-linked",
          project_id: "project-1",
          title: "Linked session",
          status: "completed",
          updated_at: "2026-06-02T12:00:00.000Z",
        },
        {
          id: "session-standalone",
          project_id: "project-1",
          title: "Standalone session",
          status: "completed",
          updated_at: "2026-06-02T11:00:00.000Z",
        },
      ],
      tickets: [],
      workspaceSessions: [{ id: "link-1", workspace_id: "workspace/one", session_id: "session-linked" }],
      workspaces: [
        {
          id: "workspace/one",
          project_id: "project-1",
          workspace_shorthand: "PS-181_A1",
        },
      ],
    });

    expect(sessions.find((session) => session.id === "session-linked")?.resource.parent).toBe(
      createDashboardResource("workspace", "workspace/one", "", undefined, "project-1").uri,
    );
    expect(sessions.find((session) => session.id === "session-standalone")?.resource.parent).toBe(
      dashboardResources.sessions.uri,
    );
  });
});
