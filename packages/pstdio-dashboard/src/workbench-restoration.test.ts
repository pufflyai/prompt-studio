import { afterEach, describe, expect, test } from "bun:test";
import { resourceKey } from "@pstdio/sdk/extensions";
import type { WorkbenchPageLocationBrowser } from "@pstdio/workbench";
import type { WorkbenchStorageLike } from "@pstdio/workbench/storage";
import { getWriter, markInitialCollectionsSyncComplete } from "@/lib/sync/collections";
import { dashboardCommandIds } from "@/shared/app/commands";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import { createDashboardProjectSelectionPersistence } from "@/shared/app/project-selection-persistence";
import { createDashboardSessionDraftPersistence } from "@/shared/app/session-draft-persistence";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { openSessionsPage, openWorkspacesPage } from "@/shared/workbench/page-navigation";
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
const browserAt = (url: string): WorkbenchPageLocationBrowser => {
  let current = { url };
  return {
    current: () => current,
    push: (entry) => {
      current = entry;
    },
    replace: (entry) => {
      current = entry;
    },
    back: () => undefined,
    forward: () => undefined,
    onPopState: () => ({ dispose: () => undefined }),
  };
};
const sessionResource = {
  type: "session",
  id: "session-1",
  label: "Session one",
};
const seedSyncedRows = () => {
  getWriter("projects")?.truncateAndWrite([
    { id: "project-1", name: "Project one", created_at: "2026-01-01T00:00:00.000Z" },
    { id: "project-2", name: "Project two", created_at: "2026-01-01T00:00:00.000Z" },
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
    .filter((panel) => panel.resource?.type === "session")
    .map((panel) => resourceKey(panel.resource));
const selectProject = (workbench: ReturnType<typeof createDashboardWorkbench>, projectId = "project-1") =>
  workbench.commands.executeCommand(dashboardCommandIds.selectProject, {
    project: { id: projectId, name: projectId },
  });
// Synced rows are process-wide; leave the tables empty so other suites start clean.
afterEach(() => {
  getWriter("projects")?.truncateAndWrite([]);
  getWriter("sessions")?.truncateAndWrite([]);
  getWriter("workspaces")?.truncateAndWrite([]);
  getWriter("workspace_sessions")?.truncateAndWrite([]);
});
describe("createDashboardWorkbench restoration", () => {
  test("restores the chosen status bar order when the dashboard starts again", async () => {
    const storage = createStorage();
    const registerIndicators = (workbench: ReturnType<typeof createDashboardWorkbench>) => {
      for (const id of ["connection", "performance"]) {
        workbench.views.registerView({ id, title: id, body: { kind: "react", render: () => null } });
        workbench.statusBar.registerItem({ id, viewId: id, slot: "trailing" });
      }
    };
    const first = createDashboardWorkbench({ storage });
    registerIndicators(first);
    first.statusBar.reorderItem("performance", { beforeItemId: "connection" });
    await first.dispose();
    const restored = createDashboardWorkbench({ storage });
    registerIndicators(restored);
    expect(restored.statusBar.listVisibleItems("trailing").map((item) => item.id)).toEqual([
      "performance",
      "connection",
    ]);
    await restored.dispose();
  });

  test("opens the project named in the URL instead of the last selected project", async () => {
    const storage = createStorage();
    createDashboardProjectSelectionPersistence({
      namespace: dashboardWorkbenchStorageNamespace,
      storage,
    }).setSelectedProjectId("project-1");
    seedSyncedRows();
    const workbench = createDashboardWorkbench({
      storage,
      pageLocationBrowser: browserAt("/projects/project-2/sessions"),
    });
    await flushMicrotasks();

    expect(getDashboardSelectedProjectId(workbench)).toBe("project-2");
  });

  test("keeps each project's Side Panel presentation when switching projects", async () => {
    const storage = createStorage();
    seedSyncedRows();
    const workbench = createDashboardWorkbench({ storage });
    await selectProject(workbench, "project-2");
    workbench.sidePanel.setMode("attached");
    await selectProject(workbench);
    expect(workbench.sidePanel.getMode()).toBe("closed");
    workbench.sidePanel.setMode("floating");
    workbench.sidePanel.setMode("closed");
    await selectProject(workbench, "project-2");
    expect(workbench.sidePanel.getMode()).toBe("attached");
  });

  test("restores each project's Side Panel presentation after reload", async () => {
    const storage = createStorage();
    seedSyncedRows();
    const first = createDashboardWorkbench({ storage });
    await selectProject(first, "project-2");
    first.sidePanel.setMode("attached");
    await selectProject(first);
    first.sidePanel.setMode("attached");
    first.sidePanel.setMode("closed");
    await first.dispose();
    const second = createDashboardWorkbench({ storage });
    await flushMicrotasks();
    expect(second.sidePanel.getMode()).toBe("closed");
    await selectProject(second, "project-2");
    expect(second.sidePanel.getMode()).toBe("attached");
    await selectProject(second);
    expect(second.sidePanel.getMode()).toBe("closed");
  });

  test("restores project chrome changed on a page after reload", async () => {
    const storage = createStorage();
    seedSyncedRows();
    const first = createDashboardWorkbench({ storage });
    await selectProject(first);
    await flushMicrotasks();
    first.layout.setRegionSize("sidenav", 333);
    await first.dispose();
    const second = createDashboardWorkbench({ storage });
    await flushMicrotasks();
    expect(second.layout.getLayout().regions.sidenav.size).toBe(333);
  });

  test("restores the Side Panel presentation, its session, and the unsent chat draft", async () => {
    const storage = createStorage();
    seedSyncedRows();
    const first = createDashboardWorkbench({ storage });
    await selectProject(first);
    await flushMicrotasks();
    await first.commands.executeCommand("dashboard.openSessionPanel", { resource: sessionResource });
    first.sidePanel.setMode("attached");
    const drafts = createDashboardSessionDraftPersistence({
      namespace: dashboardWorkbenchStorageNamespace,
      storage,
      projectSelection: { getSelectedProjectId: () => "project-1" },
    });
    drafts.setDraft("session-1", "unsent reply");
    await first.dispose();
    const second = createDashboardWorkbench({ storage });
    await flushMicrotasks();
    expect(second.sidePanel.getMode()).toBe("attached");
    expect(sidePanelSessionUris(second)).toEqual([resourceKey(sessionResource)]);
    expect(second.layout.listPanelInstances("side")[0]?.tabRetention).toBe("preview");
    expect(drafts.getDraft("session-1")).toBe("unsent reply");
  });
  test("ignores a persisted session that no longer exists", async () => {
    const storage = createStorage();
    seedSyncedRows();
    const first = createDashboardWorkbench({ storage });
    await selectProject(first);
    await flushMicrotasks();
    await first.commands.executeCommand("dashboard.openSessionPanel", { resource: sessionResource });
    getWriter("sessions")?.truncateAndWrite([]);
    const second = createDashboardWorkbench({ storage });
    await flushMicrotasks();
    expect(sidePanelSessionUris(second)).toEqual([]);
  });
  test("restores a persisted primary view before its Side Panel session", async () => {
    const storage = createStorage();
    seedSyncedRows();
    const first = createDashboardWorkbench({ storage });
    await selectProject(first);
    await flushMicrotasks();
    openWorkspacesPage(first);
    await flushMicrotasks();
    await first.commands.executeCommand("dashboard.openSessionPanel", { resource: sessionResource });
    const second = createDashboardWorkbench({ storage });
    await flushMicrotasks();
    expect(second.layout.getLayout().regions.main.widgets[0]?.viewId).toBe(dashboardWidgetIds.workspaces);
    expect(sidePanelSessionUris(second)).toEqual([resourceKey(sessionResource)]);
  });
  test("does not duplicate a primary session into the Side Panel after refresh", async () => {
    const storage = createStorage();
    seedSyncedRows();
    const first = createDashboardWorkbench({ storage });
    await selectProject(first);
    await flushMicrotasks();
    await first.commands.executeCommand("dashboard.openSessionPanel", { resource: sessionResource });
    openSessionsPage(first, sessionResource);
    expect(first.layout.listPanelInstances("side")).toEqual([]);
    const second = createDashboardWorkbench({ storage });
    await flushMicrotasks();
    expect(resourceKey(second.getPrimaryResource())).toBe(resourceKey(sessionResource));
    expect(sidePanelSessionUris(second)).toEqual([]);
  });
});
