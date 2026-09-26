import { describe, expect, test } from "bun:test";
import { getCollection, getWriter } from "@/lib/sync/collections";
import {
  buildDashboardSessionsFromRows,
  createDashboardSessions,
  resolveDashboardSessionView,
  resolveDashboardSessionViewForPlacement,
} from "./dashboard-sessions";

test("selected session and recent menus never enumerate unrelated files", () => {
  getWriter("sessions")!.upsert({ id: "keyed", title: "Selected", project_id: "project" });
  getWriter("workspace_sessions")!.upsert({ id: "keyed-link", session_id: "keyed", workspace_id: "keyed-workspace" });
  getWriter("workspaces")!.upsert({ id: "keyed-workspace", project_id: "project", name: "Workspace" });
  const files = getCollection("files");
  const descriptor = Object.getOwnPropertyDescriptor(files, "state");
  Object.defineProperty(files, "state", {
    configurable: true,
    get: () => {
      throw new Error("Files enumerated");
    },
  });
  try {
    expect(resolveDashboardSessionView("keyed").workspaceTitle).toBe("Workspace");
    expect(createDashboardSessions("project").some((session) => session.id === "keyed")).toBe(true);
    getWriter("workspace_sessions")!.remove("keyed-link");
    expect(resolveDashboardSessionView("keyed").workspaceId).toBeNull();
  } finally {
    if (descriptor) Object.defineProperty(files, "state", descriptor);
    else Reflect.deleteProperty(files, "state");
    getWriter("sessions")!.remove("keyed");
    getWriter("workspaces")!.remove("keyed-workspace");
  }
});

describe("resolveDashboardSessionView", () => {
  test("keeps an opened session addressable before synced rows arrive", () => {
    const view = resolveDashboardSessionView("session-created-from-draft");
    expect(view.id).toBe("session-created-from-draft");
    expect(view.sessionId).toBe("session-created-from-draft");
  });
  test("keeps workspace context on a new session draft placement", () => {
    const view = resolveDashboardSessionViewForPlacement({
      resource: {
        type: "session-draft",
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
        type: "session-draft",
        id: "new-workspace-1-first",
        label: "New session",
      },
    });
    const second = resolveDashboardSessionViewForPlacement({
      resource: {
        type: "session-draft",
        id: "new-workspace-1-second",
        label: "New session",
      },
    });
    expect(first.draftKey).toBe("new-workspace-1-first");
    expect(second.draftKey).toBe("new-workspace-1-second");
  });
  test("exposes session status on the session resource", () => {
    const [session] = buildDashboardSessionsFromRows({
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

test("session views expose the latest synchronized running status", () => {
  const writer = getWriter("sessions")!;
  writer.upsert({ id: "running-view", project_id: "project-1", status: "in_progress" });
  expect(resolveDashboardSessionView("running-view").status).toBe("in_progress");
  writer.upsert({ id: "running-view", project_id: "project-1", status: "completed" });
  expect(resolveDashboardSessionView("running-view").status).toBe("completed");
  writer.remove("running-view");
});
