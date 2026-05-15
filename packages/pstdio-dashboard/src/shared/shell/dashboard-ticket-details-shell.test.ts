import { describe, expect, it } from "bun:test";
import {
  createDashboardTicketDetailsShell,
  createTicketDetailsResource,
  TICKET_DETAILS_MAIN_WIDGET_ID,
  TICKET_DETAILS_MODE_ID,
  TICKET_DETAILS_NAVIGATION_TREE_ID,
  TICKET_DETAILS_OPEN_COMMAND_ID,
  TICKET_DETAILS_RESOURCE_KIND,
} from "./dashboard-ticket-details-shell";
import { DASHBOARD_COMMAND_PALETTE_MENU } from "./menu-locations";

describe("createDashboardTicketDetailsShell", () => {
  it("registers the ticket detail shell slice and opens the selected ticket resource", async () => {
    const navigations: string[] = [];
    const shell = createDashboardTicketDetailsShell({
      projectId: "proj-1",
      projectName: "Demo project",
      ticketShorthand: "PS-42",
      ticketTitle: "Wire the shell",
      navigation: {
        current: {
          getSections: () => [],
          openResource: () => undefined,
        },
      },
      navigate: (path) => navigations.push(path),
    });

    expect(shell.resources.getKind(TICKET_DETAILS_RESOURCE_KIND)?.source).toBe("product-module");
    expect(shell.modes.getActiveModeId()).toBe(TICKET_DETAILS_MODE_ID);
    expect(shell.trees.getTreeView(TICKET_DETAILS_NAVIGATION_TREE_ID)).toMatchObject({
      area: "left",
      icon: "FileText",
    });
    expect(shell.layout.getWidget(TICKET_DETAILS_MAIN_WIDGET_ID)).toMatchObject({
      area: "main",
      renderer: "react",
    });
    expect(shell.commands.getCommand(TICKET_DETAILS_OPEN_COMMAND_ID)?.command.label).toBe("Open ticket");
    expect(shell.menus.listMenuActions(DASHBOARD_COMMAND_PALETTE_MENU).map((action) => action.commandId)).toContain(
      TICKET_DETAILS_OPEN_COMMAND_ID,
    );

    expect(shell.layout.getLayout().areas.left.widgets).toEqual([]);
    expect(shell.layout.getLayout().activeWidgetId).toBe(TICKET_DETAILS_MAIN_WIDGET_ID);
    expect(shell.layout.getLayout().activeResourceUri).toBe("pstdio://project/proj-1/ticket/PS-42");

    await shell.resources.openResource(createTicketDetailsResource("proj-1", "PS-43", "Follow up"));

    expect(navigations).toEqual(["/projects/proj-1/tickets/PS-43"]);
    expect(shell.layout.getLayout().activeResourceUri).toBe("pstdio://project/proj-1/ticket/PS-43");

    shell.dispose();

    expect(shell.commands.getCommand(TICKET_DETAILS_OPEN_COMMAND_ID)).toBeUndefined();
  });
});
