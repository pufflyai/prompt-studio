import { describe, expect, mock, test } from "bun:test";
import { createWorkbenchCore, workbenchTopHeaderTrailingMenuPath } from "pstdio-workbench/core";
import { listWorkbenchMenuItems } from "pstdio-workbench/react";
import { getWriter } from "@/lib/sync/collections";
import { dashboardCommandIds } from "@/shared/app/commands";
import { selectDashboardProject } from "@/shared/app/project-context";
import { dashboardResources } from "@/shared/app/resources";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { createNotificationsModule } from "./module";
import { executeNotificationCommandAction } from "./notifications-host";

const notification = {
  id: "n1",
  projectId: "project-1",
  title: "Ready to merge",
  kind: "ready_to_merge",
  status: "open",
  priority: "normal",
  origin: "extension",
  sourceExtensionId: "pstdio-planner",
  target: { type: "ticket", id: "PS-95" },
  actions: [],
  updatedAt: "2026-06-24T10:00:00.000Z",
};

describe("createNotificationsModule", () => {
  test("registers a top header bell badge and addressable inbox resource", async () => {
    const workbench = createWorkbenchCore();
    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    workbench.resources.registerKind({ kind: "dashboard-view", label: "Dashboard", icon: "House" });
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });

    const disposable = workbench.registerModule(createNotificationsModule());
    try {
      getWriter("notifications")?.truncateAndWrite([notification]);

      const headerItems = listWorkbenchMenuItems(workbench, workbenchTopHeaderTrailingMenuPath);
      expect(headerItems).toMatchObject([{ commandId: dashboardCommandIds.openNotifications, icon: "Bell", badge: 1 }]);

      await workbench.resources.openResource(dashboardResources.notifications);
      expect(workbench.layout.getLayout().activeResourceUri).toBe(dashboardResources.notifications.uri);
      expect(workbench.layout.getLayout().areas.main.widgets[0]?.widgetId).toBe(dashboardWidgetIds.notifications);
    } finally {
      disposable.dispose();
      getWriter("notifications")?.truncateAndWrite([]);
    }
  });
});

describe("executeNotificationCommandAction", () => {
  test("runs extension-sourced command actions through the extension command endpoint", async () => {
    const workbench = createWorkbenchCore();
    const executeExtensionCommand = mock(async () => ({
      commandId: "pstdio-planner.approve-proposal",
      extensionId: "pstdio-planner",
      outcome: { ok: true, status: "success" as const },
    }));

    await executeNotificationCommandAction({
      workbench,
      projectId: "project-1",
      sourceExtensionId: "pstdio-planner",
      command: "pstdio-planner.approve-proposal",
      params: { ticketId: "PS-95" },
      executeExtensionCommand,
    });

    expect(executeExtensionCommand).toHaveBeenCalledWith("project-1", "pstdio-planner.approve-proposal", {
      params: { ticketId: "PS-95" },
      source: "dashboard",
    });
  });
});
