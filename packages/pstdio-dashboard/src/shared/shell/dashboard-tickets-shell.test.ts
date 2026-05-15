import { describe, expect, it } from "bun:test";
import { createDefaultShellLayout, type ShellLayout } from "pstdio-shell/core";
import {
  PROJECT_NAVIGATION_FOOTER_TREE_ID,
  PROJECT_NAVIGATION_HEADER_WIDGET_ID,
  PROJECT_NAVIGATION_MODE_ID,
  PROJECT_NAVIGATION_TREE_ID,
} from "./dashboard-project-shell";
import { createDashboardShellLayoutPersistence, type DashboardShellStorage } from "./dashboard-shell-persistence";
import {
  createDashboardTicketsShell,
  createTicketsResource,
  TICKETS_CREATE_COMMAND_ID,
  TICKETS_MAIN_WIDGET_ID,
  TICKETS_OPEN_COMMAND_ID,
  TICKETS_RESOURCE_KIND,
} from "./dashboard-tickets-shell";
import { DASHBOARD_COMMAND_PALETTE_MENU } from "./menu-locations";

const createStorage = (): DashboardShellStorage => {
  const values = new Map<string, string>();

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
};

const createPersistedTabbedMainLayout = () => {
  const layout: ShellLayout = createDefaultShellLayout();
  layout.areas.main = {
    ...layout.areas.main,
    activeWidgetId: "project.settings",
    widgets: [
      { widgetId: "project.settings", contributionId: "project.settings" },
      { widgetId: "stale.ticket", contributionId: "stale.ticket" },
    ],
  };
  layout.activeWidgetId = "project.settings";

  return layout;
};

describe("createDashboardTicketsShell", () => {
  it("registers the ticket list shell slice and opens the tickets resource", async () => {
    const navigations: string[] = [];
    let createRequests = 0;
    let commandPaletteRequests = 0;
    let shortcutHelpRequests = 0;
    const storage = createStorage();
    createDashboardShellLayoutPersistence({ projectId: "proj-1", storage }).setLayout(
      createPersistedTabbedMainLayout(),
    );

    const shell = createDashboardTicketsShell({
      projectId: "proj-1",
      projectName: "Demo project",
      storage,
      navigate: (path) => navigations.push(path),
      requestCreateTicket: () => {
        createRequests += 1;
      },
      openCommandPalette: () => {
        commandPaletteRequests += 1;
      },
      openShortcutHelp: () => {
        shortcutHelpRequests += 1;
      },
    });

    expect(shell.resources.getKind(TICKETS_RESOURCE_KIND)?.source).toBe("product-module");
    expect(shell.modes.getActiveModeId()).toBe(PROJECT_NAVIGATION_MODE_ID);
    expect(shell.trees.getTreeView(PROJECT_NAVIGATION_TREE_ID)).toMatchObject({
      area: "left",
      icon: "FolderKanban",
    });
    expect(shell.layout.getWidget(TICKETS_MAIN_WIDGET_ID)).toMatchObject({
      area: "main",
      renderer: "react",
    });
    expect(shell.layout.getLayout().areas["left-header"].widgets.map((widget) => widget.contributionId)).toEqual([
      PROJECT_NAVIGATION_HEADER_WIDGET_ID,
    ]);
    expect(shell.commands.getCommand(TICKETS_OPEN_COMMAND_ID)?.command.label).toBe("Open tickets");
    expect(shell.commands.getCommand(TICKETS_CREATE_COMMAND_ID)?.command.label).toBe("New ticket");
    expect(shell.menus.listMenuActions(DASHBOARD_COMMAND_PALETTE_MENU).map((action) => action.commandId)).toEqual(
      expect.arrayContaining([TICKETS_OPEN_COMMAND_ID, TICKETS_CREATE_COMMAND_ID]),
    );

    expect(shell.layout.getLayout().areas.left.widgets).toEqual([]);
    expect(shell.layout.getLayout().areas.main.widgets.map((widget) => widget.contributionId)).toEqual([
      TICKETS_MAIN_WIDGET_ID,
    ]);
    expect(shell.layout.getLayout().activeWidgetId).toBe(TICKETS_MAIN_WIDGET_ID);
    expect(shell.layout.getLayout().activeResourceUri).toBe("pstdio://project/proj-1/tickets");

    const [projectSection] = await shell.trees.getSections(PROJECT_NAVIGATION_TREE_ID);
    const [footerSection] = await shell.trees.getSections(PROJECT_NAVIGATION_FOOTER_TREE_ID);

    await shell.resources.openResource(projectSection!.nodes[0]!.resource!);
    await shell.resources.openResource(footerSection!.nodes[0]!.resource!);
    await shell.resources.openResource(createTicketsResource("proj-1"));
    await shell.commands.executeCommand(TICKETS_CREATE_COMMAND_ID);

    expect(navigations).toEqual(["/projects/proj-1/tickets"]);
    expect(createRequests).toBe(1);
    expect(commandPaletteRequests).toBe(1);
    expect(shortcutHelpRequests).toBe(1);

    shell.dispose();

    expect(shell.commands.getCommand(TICKETS_OPEN_COMMAND_ID)).toBeUndefined();
    expect(shell.commands.getCommand(TICKETS_CREATE_COMMAND_ID)).toBeUndefined();
  });
});
