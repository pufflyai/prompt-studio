import { describe, expect, test } from "bun:test";
import { contributionRefId, sessionBrowser } from "@pstdio/sdk/extensions";
import { WORKBENCH_TERMINAL_WIDGET_ID } from "@pstdio/workbench/react";
import { selectDashboardProject } from "@/shared/app/project-context";
import { dashboardHomePage } from "@/shared/app/resources";
import { registerHomePage } from "./home-page.test-support";
import { registerSessionProvider } from "./modules/sessions/session-provider.fixture";
import { createDashboardWorkbench } from "./workbench";

describe("createDashboardWorkbench", () => {
  test("starts the eligible Side Panel closed", () => {
    const workbench = createDashboardWorkbench();

    expect(workbench.sidePanel.getMode()).toBe("closed");
  });

  test("offers the session panel on project home", () => {
    const workbench = createDashboardWorkbench();

    registerHomePage(workbench);
    registerSessionProvider(workbench);
    selectDashboardProject(workbench, { id: "project-1", name: "Project" });
    workbench.pageLocations.setProject("project-1");
    expect(workbench.pageLocations.navigate({ kind: "page", page: dashboardHomePage }).ok).toBe(true);

    expect(workbench.getPrimaryResource()).toBeUndefined();
    const sessionBubble = workbench.modePlacements.getPlacement(sessionBrowser.panels.conversation);
    expect(sessionBubble?.region).toBe("side");
    expect(sessionBubble?.item).toMatchObject({
      kind: "binding",
      binding: { view: sessionBrowser.views.conversation },
    });
    const addableViews = workbench.composition
      .panelsFor("side")
      .addable.map((panel) => workbench.layout.getPanel(panel.panelId)?.rendererId);
    expect(addableViews).toContain(contributionRefId(sessionBrowser.views.conversation));
  });

  test("starts the Secondary Panel closed", () => {
    const workbench = createDashboardWorkbench();

    expect(workbench.shell.getRegionState("secondary").open).toBe(false);
    expect(workbench.layout.getLayout().regions.secondary.visible).toBe(false);
  });

  test("registers the host terminal surface and API session presenter", () => {
    const workbench = createDashboardWorkbench();

    expect(workbench.shellPlacements.getPlacement(WORKBENCH_TERMINAL_WIDGET_ID)).toMatchObject({
      region: "secondary",
      mountStrategy: "keep-mounted",
      item: { kind: "binding", binding: { view: { id: WORKBENCH_TERMINAL_WIDGET_ID }, cardinality: "many" } },
    });
    expect(workbench.terminal.isAvailable()).toBe(true);
  });
});
