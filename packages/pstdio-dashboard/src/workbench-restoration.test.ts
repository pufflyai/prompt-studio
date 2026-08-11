import { afterEach, describe, expect, test } from "bun:test";
import type { WorkbenchStorageLike } from "@pstdio/workbench/storage";
import { getWriter, markInitialCollectionsSyncComplete } from "@/lib/sync/collections";
import { createDashboardSessionDraftPersistence } from "@/shared/app/session-draft-persistence";
import { flushMicrotasks } from "./modules/extensions/module-test-fixtures";
import { createDashboardWorkbench, dashboardWorkbenchStorageNamespace } from "./workbench";

const createStorage = (): WorkbenchStorageLike => {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
};

const projectResource = {
  kind: "project",
  uri: "dashboard-workbench://project/project-1",
  id: "project-1",
  label: "Project one",
};

const sessionResource = {
  kind: "session",
  uri: "dashboard-workbench://session/session-1",
  id: "session-1",
  label: "Session one",
};

const seedSyncedRows = () => {
  getWriter("projects")?.truncateAndWrite([
    { id: "project-1", name: "Project one", created_at: "2026-01-01T00:00:00.000Z" },
  ]);
  getWriter("sessions")?.truncateAndWrite([
    {
      id: "session-1",
      project_id: "project-1",
      title: "Session one",
      status: "completed",
      agent: null,
      last_selected_model: null,
      archived: false,
      last_request_started: "2026-05-22T09:40:00Z",
      last_request_ended: "2026-05-22T09:45:00Z",
      created_at: "2026-05-22T08:20:00Z",
      updated_at: "2026-05-22T08:20:00Z",
      deleted_at: null,
    },
  ]);
  getWriter("workspaces")?.truncateAndWrite([]);
  getWriter("workspace_sessions")?.truncateAndWrite([]);
  markInitialCollectionsSyncComplete();
};

const sidePanelSessionUris = (workbench: ReturnType<typeof createDashboardWorkbench>) =>
  workbench.layout
    .listPanelInstances("side")
    .filter((panel) => panel.resource?.kind === "session")
    .map((panel) => panel.resource?.uri);

// Synced rows are process-wide; leave the tables empty so other suites start clean.
afterEach(() => {
  getWriter("projects")?.truncateAndWrite([]);
  getWriter("sessions")?.truncateAndWrite([]);
  getWriter("workspaces")?.truncateAndWrite([]);
  getWriter("workspace_sessions")?.truncateAndWrite([]);
});

describe("createDashboardWorkbench restoration", () => {
  test("restores the Side Panel presentation, its session, and the unsent chat draft", async () => {
    const storage = createStorage();
    seedSyncedRows();

    const first = createDashboardWorkbench({ storage });
    await first.resources.openResource(projectResource);
    await flushMicrotasks();
    await first.commands.executeCommand("dashboard.openSessionPanel", { resource: sessionResource });
    first.sidePanel.setMode("attached");

    const drafts = createDashboardSessionDraftPersistence({
      namespace: dashboardWorkbenchStorageNamespace,
      storage,
      projectSelection: { getSelectedProjectId: () => "project-1" },
    });
    drafts.setDraft("session-1", "unsent reply");

    const second = createDashboardWorkbench({ storage });
    await flushMicrotasks();

    expect(second.sidePanel.getMode()).toBe("attached");
    expect(sidePanelSessionUris(second)).toEqual([sessionResource.uri]);
    expect(second.layout.listPanelInstances("side")[0]?.tabRetention).toBe("preview");
    expect(drafts.getDraft("session-1")).toBe("unsent reply");
  });

  test("ignores a persisted session that no longer exists", async () => {
    const storage = createStorage();
    seedSyncedRows();

    const first = createDashboardWorkbench({ storage });
    await first.resources.openResource(projectResource);
    await flushMicrotasks();
    await first.commands.executeCommand("dashboard.openSessionPanel", { resource: sessionResource });

    getWriter("sessions")?.truncateAndWrite([]);

    const second = createDashboardWorkbench({ storage });
    await flushMicrotasks();

    expect(sidePanelSessionUris(second)).toEqual([]);
  });

  test("keeps the persisted primary resource when a Side Panel session is restored", async () => {
    const storage = createStorage();
    seedSyncedRows();

    const first = createDashboardWorkbench({ storage });
    await first.resources.openResource(projectResource);
    await flushMicrotasks();
    await first.resources.openResource(
      { kind: "dashboard-view", uri: "dashboard-workbench://dashboard-view/workspaces", id: "workspaces" },
      { replaceActive: true },
    );
    await first.commands.executeCommand("dashboard.openSessionPanel", { resource: sessionResource });

    const second = createDashboardWorkbench({ storage });
    await flushMicrotasks();

    expect(second.getPrimaryResource()?.uri).toBe("dashboard-workbench://dashboard-view/workspaces");
    expect(second.lastResource.get()?.uri).toBe("dashboard-workbench://dashboard-view/workspaces");
    expect(sidePanelSessionUris(second)).toEqual([sessionResource.uri]);
  });

  test("does not duplicate a primary session into the Side Panel after refresh", async () => {
    const storage = createStorage();
    seedSyncedRows();

    const first = createDashboardWorkbench({ storage });
    await first.resources.openResource(projectResource);
    await flushMicrotasks();
    await first.commands.executeCommand("dashboard.openSessionPanel", { resource: sessionResource });
    await first.resources.openResource(sessionResource, { replaceActive: true });
    expect(first.layout.listPanelInstances("side")).toEqual([]);

    const second = createDashboardWorkbench({ storage });
    await flushMicrotasks();

    expect(second.getPrimaryResource()?.uri).toBe(sessionResource.uri);
    expect(sidePanelSessionUris(second)).toEqual([]);
  });
});
