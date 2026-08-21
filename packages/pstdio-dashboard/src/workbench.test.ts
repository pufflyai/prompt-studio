import { describe, expect, test } from "bun:test";
import { WORKBENCH_TERMINAL_LAUNCHER_WIDGET_ID, WORKBENCH_TERMINAL_WIDGET_ID } from "@pstdio/workbench/react";
import { selectDashboardProject } from "@/shared/app/project-context";
import { dashboardResources } from "@/shared/app/resources";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { createDashboardWorkbench } from "./workbench";

describe("createDashboardWorkbench", () => {
  test("starts the eligible Side Panel closed", () => {
    const workbench = createDashboardWorkbench();

    expect(workbench.sidePanel.getMode()).toBe("closed");
  });

  test("offers the session panel on project home", async () => {
    const workbench = createDashboardWorkbench();

    selectDashboardProject(workbench, { id: "project-1", name: "Project" });
    await workbench.resources.openResource(dashboardResources.start);

    expect(workbench.getPrimaryResource()).toEqual(dashboardResources.start);
    expect(workbench.layout.getPanel(dashboardWidgetIds.sessionBubble)).toMatchObject({
      region: "side",
      eligibleLocations: { resourceKinds: ["dashboard-view", "extension-view", "ticket", "workspace"] },
    });
    expect(workbench.composition.panelsFor("side").addable.map((panel) => panel.panelId)).toContain(
      dashboardWidgetIds.sessionBubble,
    );
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
      mountStrategy: "keep-mounted",
      reuse: "none",
      singleton: false,
    });
    expect(workbench.layout.getPanel(WORKBENCH_TERMINAL_WIDGET_ID)).not.toHaveProperty("closable");
    expect(workbench.layout.getPanel(WORKBENCH_TERMINAL_LAUNCHER_WIDGET_ID)).toMatchObject({
      region: "secondary",
      hiddenByDefault: true,
      title: "Terminal",
    });
    expect(workbench.terminal.isAvailable()).toBe(true);
  });
});
