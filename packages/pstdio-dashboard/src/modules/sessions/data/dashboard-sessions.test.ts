import { describe, expect, test } from "bun:test";
import { getCollection, getRuntimeCollections, getWriter } from "@/lib/sync/collections";
import {
  buildDashboardSessionsFromRows,
  createDashboardSessions,
  resolveDashboardSessionView,
  resolveDashboardSessionViewForPlacement,
} from "./dashboard-sessions";

test("ten thousand sessions reuse their snapshot during unrelated sync writes", () => {
  const writer = getWriter("sessions")!;
  const rows = Array.from({ length: 10_000 }, (_, index) => ({
    id: `cache-scale-${index}`,
    project_id: "cache-scale-project",
    updated_at: new Date(index * 1000).toISOString(),
  }));
  const previous = [...getCollection("sessions").values()];
  writer.truncateAndWrite(rows);
  try {
    const snapshot = createDashboardSessions("cache-scale-project");
    expect(snapshot).toHaveLength(10_000);
    expect(snapshot[0].id).toBe("cache-scale-9999");
    for (const table of ["files", "notifications", "settings", "extension_instances"] as const) {
      const unrelated = getWriter(table)!;
      unrelated.upsert({ id: "cache-scale-unrelated", value: "changed" });
      expect(createDashboardSessions("cache-scale-project")).toBe(snapshot);
      unrelated.remove("cache-scale-unrelated");
      expect(createDashboardSessions("cache-scale-project")).toBe(snapshot);
    }
    getRuntimeCollections().markInitialCollectionsSyncComplete();
    expect(createDashboardSessions("cache-scale-project")).toBe(snapshot);
    writer.upsert({ ...rows[0], updated_at: "2099-01-01T00:00:00Z" });
    expect(createDashboardSessions("cache-scale-project")[0].id).toBe(rows[0].id);
  } finally {
    writer.truncateAndWrite(previous);
  }
});

test("workspace snapshots, edits, links and removals invalidate session snapshots", () => {
  const sessions = getWriter("sessions")!;
  const workspaces = getWriter("workspaces")!;
  const links = getWriter("workspace_sessions")!;
  sessions.upsert({ id: "cache-linked", project_id: "cache-linked-project" });
  try {
    expect(createDashboardSessions("cache-linked-project")[0].workspaceId).toBeNull();
    workspaces.upsert({ id: "cache-workspace", project_id: "cache-linked-project", branch: "before" });
    links.upsert({ id: "cache-link", workspace_id: "cache-workspace", session_id: "cache-linked" });
    expect(createDashboardSessions("cache-linked-project")[0].workspaceBranch).toBe("before");
    workspaces.upsert({ id: "cache-workspace", project_id: "cache-linked-project", branch: "after" });
    expect(createDashboardSessions("cache-linked-project")[0].workspaceBranch).toBe("after");
    links.remove("cache-link");
    expect(createDashboardSessions("cache-linked-project")[0].workspaceId).toBeNull();
  } finally {
    sessions.remove("cache-linked");
    workspaces.remove("cache-workspace");
    links.remove("cache-link");
  }
});

test("unchanged session lists share a snapshot and synced edits invalidate it", () => {
  const writer = getWriter("sessions")!;
  writer.upsert({ id: "snapshot-session", title: "Before", project_id: "snapshot-project" });
  try {
    const first = createDashboardSessions("snapshot-project");
    expect(createDashboardSessions("snapshot-project")).toBe(first);
    expect(createDashboardSessions("other-project")).toEqual([]);
    writer.upsert({ id: "snapshot-session", title: "After", project_id: "snapshot-project" });
    const updated = createDashboardSessions("snapshot-project");
    expect(updated).not.toBe(first);
    expect(updated[0].title).toBe("After");
    writer.remove("snapshot-session");
    expect(createDashboardSessions("snapshot-project")).toEqual([]);
  } finally {
    writer.remove("snapshot-session");
  }
});

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
  test("a draft's explicit harness stays local to that presentation", () => {
    const view = resolveDashboardSessionViewForPlacement({
      resource: { type: "session-draft", id: "local", metadata: { agent: "acme.worker" } },
    });
    const other = resolveDashboardSessionViewForPlacement({ resource: { type: "session-draft", id: "other" } });
    expect(view.agent).toBe("acme.worker");
    expect(view.sessionId).toBeUndefined();
    expect(other.agent).toBeNull();
  });
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
  const startedAt = "2026-10-01T12:00:00.000Z";
  writer.upsert({
    id: "running-view",
    project_id: "project-1",
    status: "in_progress",
    last_request_started: startedAt,
  });
  expect(resolveDashboardSessionView("running-view").status).toBe("in_progress");
  expect(resolveDashboardSessionView("running-view").lastRequestStarted).toBe(startedAt);
  writer.upsert({ id: "running-view", project_id: "project-1", status: "completed" });
  expect(resolveDashboardSessionView("running-view").status).toBe("completed");
  writer.remove("running-view");
});

test("session views expose the saved harness parameters", () => {
  const writer = getWriter("sessions")!;
  writer.upsert({ id: "effort-view", project_id: "project-1", params_json: { model_reasoning_effort: "high" } });
  expect(resolveDashboardSessionView("effort-view").params).toEqual({ model_reasoning_effort: "high" });
  writer.remove("effort-view");
});
