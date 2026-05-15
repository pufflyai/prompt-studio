import { describe, expect, it } from "bun:test";
import {
  createDashboardWorkspaceShell,
  createWorkspaceResource,
  WORKSPACE_MAIN_WIDGET_ID,
  WORKSPACE_MODE_ID,
  WORKSPACE_NAVIGATION_TREE_ID,
  WORKSPACE_OPEN_COMMAND_ID,
  WORKSPACE_RESOURCE_KIND,
} from "./dashboard-workspace-shell";
import { DASHBOARD_COMMAND_PALETTE_MENU } from "./menu-locations";
import { TICKET_DETAILS_NAVIGATION_RESOURCE_KIND } from "./ticket-details/dashboard-ticket-details-module";

describe("createDashboardWorkspaceShell", () => {
  it("registers the workspace shell slice and opens workspace resources", async () => {
    const navigations: string[] = [];
    const shell = createDashboardWorkspaceShell({
      projectId: "proj-1",
      projectName: "Demo project",
      ticketShorthand: "PS-42",
      workspaceShorthand: "PS-42_A1",
      navigation: {
        current: {
          getSections: () => [],
          openResource: () => undefined,
        },
      },
      navigate: (path) => navigations.push(path),
    });

    expect(shell.resources.getKind(WORKSPACE_RESOURCE_KIND)?.source).toBe("product-module");
    expect(shell.resources.getKind(TICKET_DETAILS_NAVIGATION_RESOURCE_KIND)?.source).toBe("product-module");
    expect(shell.modes.getActiveModeId()).toBe(WORKSPACE_MODE_ID);
    expect(shell.trees.getTreeView(WORKSPACE_NAVIGATION_TREE_ID)).toMatchObject({
      area: "left",
      icon: "GitBranch",
    });
    expect(shell.layout.getWidget(WORKSPACE_MAIN_WIDGET_ID)).toMatchObject({
      area: "main",
      renderer: "react",
    });
    expect(shell.commands.getCommand(WORKSPACE_OPEN_COMMAND_ID)?.command.label).toBe("Open workspace");
    expect(shell.menus.listMenuActions(DASHBOARD_COMMAND_PALETTE_MENU).map((action) => action.commandId)).toContain(
      WORKSPACE_OPEN_COMMAND_ID,
    );

    expect(shell.layout.getLayout().areas.left.widgets).toEqual([]);
    expect(shell.layout.getLayout().activeWidgetId).toBe(WORKSPACE_MAIN_WIDGET_ID);
    expect(shell.layout.getLayout().activeResourceUri).toBe("pstdio://project/proj-1/ticket/PS-42/workspace/PS-42_A1");

    await shell.resources.openResource(createWorkspaceResource("proj-1", "PS-43", "PS-43_A2"));

    expect(navigations).toEqual(["/projects/proj-1/tickets/PS-43/workspaces/PS-43_A2"]);
    expect(shell.layout.getLayout().activeResourceUri).toBe("pstdio://project/proj-1/ticket/PS-43/workspace/PS-43_A2");

    shell.dispose();

    expect(shell.commands.getCommand(WORKSPACE_OPEN_COMMAND_ID)).toBeUndefined();
  });
});
