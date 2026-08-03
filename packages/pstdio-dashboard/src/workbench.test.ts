import { describe, expect, test } from "bun:test";
import { WORKBENCH_TERMINAL_LAUNCHER_WIDGET_ID, WORKBENCH_TERMINAL_WIDGET_ID } from "@pstdio/workbench/react";
import type { WorkbenchStorageLike } from "@pstdio/workbench/storage";
import { workbenchStoragePersistenceKey } from "@pstdio/workbench/storage";
import { getWriter, markInitialCollectionsSyncComplete } from "@/lib/sync/collections";
import { getDashboardSelectedSessionId } from "@/modules/sessions/state/session-selection";
import { dashboardSessionSelectionStorageKey } from "@/modules/sessions/state/session-selection-persistence";
import { dashboardCommandIds } from "@/shared/app/commands";
import { selectDashboardProject } from "@/shared/app/project-context";
import { createDashboardProjectSelectionPersistence } from "@/shared/app/project-selection-persistence";
import { createDashboardResource, dashboardResources } from "@/shared/app/resources";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { flushMicrotasks } from "./modules/extensions/module-test-fixtures";
import { createDashboardWorkbench } from "./workbench";

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

const createPersistenceEventTarget = () => {
  const listeners = new Set<() => void>();

  return {
    addEventListener: (_type: "pagehide", listener: () => void) => {
      listeners.add(listener);
    },
    dispatchPagehide: () => {
      for (const listener of listeners) listener();
    },
    removeEventListener: (_type: "pagehide", listener: () => void) => {
      listeners.delete(listener);
    },
  };
};

describe("createDashboardWorkbench", () => {
  test("starts the eligible Side Panel closed", () => {
    const workbench = createDashboardWorkbench();

    expect(workbench.sidePanel.getMode()).toBe("closed");
  });

  test("starts the Secondary Panel closed", () => {
    const workbench = createDashboardWorkbench();

    expect(workbench.panels.isOpen("secondary")).toBe(false);
    expect(workbench.layout.getLayout().regions.secondary.visible).toBe(false);
  });

  test("registers the host terminal surface and API session presenter", () => {
    const workbench = createDashboardWorkbench();

    expect(workbench.layout.getPanel(WORKBENCH_TERMINAL_WIDGET_ID)).toMatchObject({
      region: "secondary",
      title: "Terminal",
      closable: true,
      mountStrategy: "keep-mounted",
      reuse: "none",
      singleton: false,
    });
    expect(workbench.layout.getPanel(WORKBENCH_TERMINAL_LAUNCHER_WIDGET_ID)).toMatchObject({
      region: "secondary",
      hiddenByDefault: true,
      title: "Terminal",
    });
    expect(workbench.terminal.isAvailable()).toBe(true);
  });

  test("restores floating and closed Side Panel modes after reconstruction", () => {
    for (const mode of ["floating", "closed"] as const) {
      const storage = createStorage();
      const first = createDashboardWorkbench({ storage });
      first.sidePanel.setMode("floating");
      first.sidePanel.setMode(mode);

      expect(createDashboardWorkbench({ storage }).sidePanel.getMode()).toBe(mode);
    }
  });

  test("restores the attached Side Panel and selected existing session after reconstruction", async () => {
    const storage = createStorage();
    const project = { id: "project-1", name: "Prompt Studio" };
    const session = createDashboardResource("session", "session-1", "Session one", "MessageCircle", project.id, {
      status: "completed",
    });
    getWriter("sessions")?.truncateAndWrite([
      {
        id: session.id,
        project_id: project.id,
        title: session.label,
        status: "completed",
        agent: null,
        last_selected_model: null,
        archived: false,
        created_at: "2026-07-28T10:00:00.000Z",
        updated_at: "2026-07-28T10:00:00.000Z",
        deleted_at: null,
      },
    ]);
    markInitialCollectionsSyncComplete();

    try {
      const first = createDashboardWorkbench({ storage });
      const projectSelectionPersistence = createDashboardProjectSelectionPersistence({
        namespace: "dashboard-wb",
        storage,
      });
      selectDashboardProject(first, project, projectSelectionPersistence);
      first.lastResource.set(dashboardResources.workspaces);
      await first.commands.executeCommand(dashboardCommandIds.openSessionPanel, { resource: session });
      first.sidePanel.setMode("attached");
      expect(storage.getItem(workbenchStoragePersistenceKey("dashboard-wb", "side-panel", undefined))).toBe(
        JSON.stringify({ version: 1, mode: "attached" }),
      );

      const restored = createDashboardWorkbench({ storage });
      selectDashboardProject(restored, project);
      await flushMicrotasks();

      expect(restored.sidePanel.getMode()).toBe("attached");
      expect(getDashboardSelectedSessionId(restored)).toBe(session.id);
      expect(restored.lastResource.get()?.uri).toBe(dashboardResources.workspaces.uri);
      expect(
        restored.layout
          .getLayout()
          .regions.side.widgets.find((widget) => widget.contributionId === dashboardWidgetIds.sessionBubble)?.resource
          ?.id,
      ).toBe(session.id);
    } finally {
      getWriter("sessions")?.truncateAndWrite([]);
    }
  });
});

describe("createDashboardWorkbench Side Panel sessions", () => {
  test("restores multiple user-created Side Panel session tabs after reconstruction", async () => {
    const storage = createStorage();
    const persistenceEventTarget = createPersistenceEventTarget();
    const project = { id: "project-1", name: "Prompt Studio" };
    const workspaceId = "workspace-1";
    const firstSession = createDashboardResource("session", "session-1", "Session one", "MessageCircle", project.id, {
      status: "completed",
      workspaceId,
    });
    getWriter("projects")?.truncateAndWrite([
      { id: project.id, name: project.name, created_at: "2026-07-28T08:00:00.000Z" },
    ]);
    getWriter("workspaces")?.truncateAndWrite([
      {
        id: workspaceId,
        project_id: project.id,
        name: "Dashboard workbench datalayer",
        branch: "workspace/PS-8_A1",
        worktree_path: "/repo/.pstdio/workspaces/PS-8_A1",
        archived: false,
        workspace_shorthand: "PS-8_A1",
        setup_error: null,
        created_at: "2026-07-28T09:00:00.000Z",
        updated_at: "2026-07-28T09:00:00.000Z",
        deleted_at: null,
      },
    ]);
    getWriter("sessions")?.truncateAndWrite([
      {
        id: firstSession.id,
        project_id: project.id,
        title: firstSession.label,
        status: "completed",
        agent: null,
        last_selected_model: null,
        archived: false,
        created_at: "2026-07-28T10:00:00.000Z",
        updated_at: "2026-07-28T10:00:00.000Z",
        deleted_at: null,
      },
    ]);
    getWriter("workspace_sessions")?.truncateAndWrite([
      { id: "workspace-session-1", workspace_id: workspaceId, session_id: firstSession.id },
    ]);
    markInitialCollectionsSyncComplete();

    try {
      const first = createDashboardWorkbench({ persistenceEventTarget, storage });
      const projectSelectionPersistence = createDashboardProjectSelectionPersistence({
        namespace: "dashboard-wb",
        storage,
      });
      selectDashboardProject(first, project, projectSelectionPersistence);
      const workspace = first.resources.listResources("").find((entry) => entry.resource.id === workspaceId)?.resource;
      await first.resources.openResource(workspace!, { replaceActive: true });
      await first.commands.executeCommand(dashboardCommandIds.createSession, undefined, { source: "panel-add" });
      await first.commands.executeCommand(dashboardCommandIds.createSession, undefined, { source: "panel-add" });
      first.sidePanel.setMode("attached");
      expect(
        first.layout
          .listPanelInstances("side")
          .filter((panel) => panel.panelId === dashboardWidgetIds.sessionBubble)
          .map((panel) => panel.tabRetention),
      ).toEqual(["preview", "persistent", "persistent"]);
      persistenceEventTarget.dispatchPagehide();
      const workspaceLayoutKey = workbenchStoragePersistenceKey(
        "dashboard-wb",
        "layout",
        `project/${project.id}/mode/workspace/resource/dashboard-workbench://workspace/${workspaceId}`,
      );
      const persistedWorkspaceLayout = JSON.parse(storage.getItem(workspaceLayoutKey)!);
      expect(
        persistedWorkspaceLayout.layout.regions.side.widgets.map(
          (widget: {
            ownerResourceUri?: string;
            resource?: { kind?: string };
            role?: string;
            tabRetention?: string;
          }) => ({
            kind: widget.resource?.kind,
            owner: widget.ownerResourceUri,
            role: widget.role,
            retention: widget.tabRetention,
          }),
        ),
      ).toEqual([
        {
          kind: "session-draft",
          owner: `dashboard-workbench://workspace/${workspaceId}`,
          role: "sub-panel",
          retention: "persistent",
        },
        {
          kind: "session-draft",
          owner: `dashboard-workbench://workspace/${workspaceId}`,
          role: "sub-panel",
          retention: "persistent",
        },
      ]);

      const restored = createDashboardWorkbench({ persistenceEventTarget, storage });
      await flushMicrotasks();

      const restoredSessionPanels = restored.layout
        .listPanelInstances("side")
        .filter((panel) => panel.panelId === dashboardWidgetIds.sessionBubble);

      expect(restored.sidePanel.getMode()).toBe("attached");
      expect(restored.getPrimaryResource()?.uri).toBe(`dashboard-workbench://workspace/${workspaceId}`);
      expect(restored.layout.getPersistenceScope()).toBe(
        `project/${project.id}/mode/workspace/resource/dashboard-workbench://workspace/${workspaceId}`,
      );
      expect(
        restoredSessionPanels.map((panel) => ({
          kind: panel.resource?.kind,
          retention: panel.tabRetention,
        })),
      ).toEqual([
        { kind: "session", retention: "preview" },
        { kind: "session-draft", retention: "persistent" },
        { kind: "session-draft", retention: "persistent" },
      ]);
      expect(restoredSessionPanels).toHaveLength(3);
      expect(restoredSessionPanels.map((panel) => panel.resource?.kind)).toEqual([
        "session",
        "session-draft",
        "session-draft",
      ]);
      expect(restoredSessionPanels.map((panel) => panel.tabRetention)).toEqual(["preview", "persistent", "persistent"]);
    } finally {
      getWriter("projects")?.truncateAndWrite([]);
      getWriter("workspaces")?.truncateAndWrite([]);
      getWriter("sessions")?.truncateAndWrite([]);
      getWriter("workspace_sessions")?.truncateAndWrite([]);
    }
  });
});

describe("createDashboardWorkbench session selection", () => {
  test("clears a persisted session that is missing from the selected project", async () => {
    const storage = createStorage();
    const project = { id: "project-1", name: "Prompt Studio" };
    const key = dashboardSessionSelectionStorageKey("dashboard-wb", project.id);
    storage.setItem(key, "deleted-session");
    markInitialCollectionsSyncComplete();

    const workbench = createDashboardWorkbench({ storage });
    selectDashboardProject(workbench, project);
    await flushMicrotasks();

    expect(getDashboardSelectedSessionId(workbench)).toBeUndefined();
    expect(storage.getItem(key)).toBeNull();
  });

  test("does not restore an existing session after opening a new draft", async () => {
    const storage = createStorage();
    const project = { id: "project-1", name: "Prompt Studio" };
    const session = createDashboardResource("session", "session-1", "Session one", "MessageCircle", project.id);
    const first = createDashboardWorkbench({ storage });
    selectDashboardProject(first, project);

    await first.commands.executeCommand(dashboardCommandIds.openSessionPanel, { resource: session });
    await first.commands.executeCommand(dashboardCommandIds.createSession);

    const restored = createDashboardWorkbench({ storage });
    selectDashboardProject(restored, project);

    expect(getDashboardSelectedSessionId(restored)).toBeUndefined();
  });
});
