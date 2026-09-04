import { describe, expect, test } from "bun:test";
import { workbenchPages, workbenchPanels } from "@pstdio/sdk/extensions";
import { WORKBENCH_TERMINAL_WIDGET_ID } from "@pstdio/workbench/react";
import { selectDashboardProject } from "@/shared/app/project-context";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { createDashboardWorkbench } from "./workbench";

describe("createDashboardWorkbench", () => {
  test("starts the eligible Side Panel closed", () => {
    const workbench = createDashboardWorkbench();

    expect(workbench.sidePanel.getMode()).toBe("closed");
  });

  test("offers the session panel on project home", () => {
    const workbench = createDashboardWorkbench();

    selectDashboardProject(workbench, { id: "project-1", name: "Project" });
    workbench.pageLocations.setProject("project-1");
    workbench.pageLocations.navigate({ kind: "page", page: workbenchPages.start });

    expect(workbench.getPrimaryResource()).toBeUndefined();
    const sessionBubble = workbench.modePlacements.getPlacement(workbenchPanels.projectSession);
    expect(sessionBubble?.region).toBe("side");
    expect(sessionBubble?.item).toMatchObject({ kind: "resource", viewId: dashboardWidgetIds.sessionBubble });
    const addableViews = workbench.composition
      .panelsFor("side")
      .addable.map((panel) => workbench.layout.getPanel(panel.panelId)?.rendererId);
    expect(addableViews).toContain(dashboardWidgetIds.sessionBubble);
  });

  test("starts the Secondary Panel closed", () => {
    const workbench = createDashboardWorkbench();

    expect(workbench.panels.isOpen("secondary")).toBe(false);
    expect(workbench.layout.getLayout().regions.secondary.visible).toBe(false);
  });

  test("registers the host terminal surface and API session presenter", () => {
    const workbench = createDashboardWorkbench();

    expect(workbench.shellPlacements.getPlacement(WORKBENCH_TERMINAL_WIDGET_ID)).toMatchObject({
      region: "secondary",
      mountStrategy: "keep-mounted",
      item: { kind: "resource", viewId: WORKBENCH_TERMINAL_WIDGET_ID, cardinality: "many" },
    });
    expect(workbench.terminal.isAvailable()).toBe(true);
  });
});
