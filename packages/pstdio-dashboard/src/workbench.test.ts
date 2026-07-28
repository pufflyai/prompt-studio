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
