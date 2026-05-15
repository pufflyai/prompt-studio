import { describe, expect, it } from "bun:test";
import {
  createDashboardProjectShell,
  DASHBOARD_COMMAND_RESOURCE_KIND,
  PROJECT_NAVIGATION_FOOTER_TREE_ID,
  PROJECT_NAVIGATION_HEADER_WIDGET_ID,
  PROJECT_NAVIGATION_MODE_ID,
  PROJECT_NAVIGATION_TREE_ID,
  PROJECT_OPEN_SETTINGS_COMMAND_ID,
  PROJECT_RESOURCE_KIND,
  PROJECT_ROUTE_RESOURCE_KIND,
  PROJECT_SETTINGS_WIDGET_ID,
} from "./dashboard-project-shell";
import { DASHBOARD_COMMAND_PALETTE_MENU } from "./menu-locations";

describe("createDashboardProjectShell", () => {
  it("registers a first-party project shell slice and opens settings through the shell", async () => {
    const navigations: string[] = [];
    let commandPaletteRequests = 0;
    let shortcutHelpRequests = 0;
    const shell = createDashboardProjectShell({
      projectId: "project-1",
      projectName: "Prompt Studio",
      navigate: (path) => navigations.push(path),
      openCommandPalette: () => {
        commandPaletteRequests += 1;
      },
      openShortcutHelp: () => {
        shortcutHelpRequests += 1;
      },
    });

    expect(shell.resources.getKind(PROJECT_RESOURCE_KIND)?.source).toBe("module");
    expect(shell.resources.getKind(PROJECT_ROUTE_RESOURCE_KIND)?.source).toBe("module");
    expect(shell.resources.getKind(DASHBOARD_COMMAND_RESOURCE_KIND)?.source).toBe("module");
    expect(shell.modes.getActiveModeId()).toBe(PROJECT_NAVIGATION_MODE_ID);
    expect(shell.layout.getWidget(PROJECT_SETTINGS_WIDGET_ID)?.rendererId).toBe(PROJECT_SETTINGS_WIDGET_ID);
    expect(shell.layout.getWidget(PROJECT_NAVIGATION_HEADER_WIDGET_ID)?.rendererId).toBe(
      PROJECT_NAVIGATION_HEADER_WIDGET_ID,
    );
    expect(shell.layout.getLayout().areas["left-header"].widgets.map((widget) => widget.contributionId)).toEqual([
      PROJECT_NAVIGATION_HEADER_WIDGET_ID,
    ]);
    expect(shell.commands.getCommand(PROJECT_OPEN_SETTINGS_COMMAND_ID)?.command.label).toBe("Project settings");
    expect(shell.menus.listMenuActions(DASHBOARD_COMMAND_PALETTE_MENU).map((action) => action.commandId)).toContain(
      PROJECT_OPEN_SETTINGS_COMMAND_ID,
    );
    expect(
      shell.keybindings.listActiveKeybindings().map(({ commandId, keybinding }) => ({ commandId, keybinding })),
    ).toEqual([
      { commandId: "dashboard.closeOverlay", keybinding: "Escape" },
      { commandId: "project.createTicket", keybinding: "Ctrl+Shift+C" },
      { commandId: "project.createSession", keybinding: "Ctrl+Shift+S" },
      { commandId: "project.goToTickets", keybinding: "Ctrl+Shift+T" },
      { commandId: "dashboard.openCommandPalette", keybinding: "Ctrl+Shift+P" },
      { commandId: "dashboard.openCommandPaletteCommands", keybinding: "Ctrl+Shift+." },
      { commandId: "dashboard.changeTheme", keybinding: "Ctrl+Shift+K" },
      { commandId: "dashboard.openShortcutHelp", keybinding: "Ctrl+Shift+H" },
      { commandId: PROJECT_OPEN_SETTINGS_COMMAND_ID, keybinding: "Ctrl+Shift+," },
    ]);

    const sections = await shell.trees.getSections(PROJECT_NAVIGATION_TREE_ID);
    const footerSections = await shell.trees.getSections(PROJECT_NAVIGATION_FOOTER_TREE_ID);
    const [root] = await shell.trees.getRoots(PROJECT_NAVIGATION_TREE_ID);

    expect(root?.resource?.uri).toBe("pstdio://project/project-1");
    expect(sections[0]?.nodes.map((node) => node.label)).toEqual(["Search", "Tickets"]);
    expect(sections[0]?.nodes.map((node) => node.resource?.kind)).toEqual([
      DASHBOARD_COMMAND_RESOURCE_KIND,
      PROJECT_ROUTE_RESOURCE_KIND,
    ]);
    expect(sections[0]?.nodes.map((node) => node.resource?.uri)).toEqual([
      "pstdio://project/project-1/command/dashboard.openCommandPalette",
      "pstdio://project/project-1/tickets",
    ]);
    expect(footerSections[0]?.nodes.map((node) => node.label)).toEqual(["Help", "Sessions", "Project settings"]);
    expect(footerSections[0]?.nodes.map((node) => node.resource?.uri)).toEqual([
      "pstdio://project/project-1/command/dashboard.openShortcutHelp",
      "pstdio://project/project-1/sessions",
      "pstdio://project/project-1/settings",
    ]);
    expect(footerSections[0]?.nodes.map((node) => node.resource?.kind)).toEqual([
      DASHBOARD_COMMAND_RESOURCE_KIND,
      PROJECT_ROUTE_RESOURCE_KIND,
      PROJECT_ROUTE_RESOURCE_KIND,
    ]);
    expect(sections[0]?.nodes.map((node) => node.resource?.uri)).not.toContain("pstdio://project/project-1/sessions");
    const projectResource = shell.navigation.resolveLocation("pstdio://project/project-1");

    expect(projectResource).toMatchObject({
      kind: PROJECT_RESOURCE_KIND,
      id: "project-1",
      label: "Prompt Studio",
    });
    expect(shell.navigation.createHref(projectResource)).toBe("/projects/project-1/settings");
    expect(
      shell.navigation.createHref({
        kind: PROJECT_ROUTE_RESOURCE_KIND,
        uri: "pstdio://project/project-1/tickets/PS-42",
      }),
    ).toBe("/projects/project-1/tickets/PS-42");

    await shell.resources.openResource(sections[0]!.nodes[0]!.resource!);
    await shell.resources.openResource(footerSections[0]!.nodes[0]!.resource!);
    await shell.commands.executeCommand(PROJECT_OPEN_SETTINGS_COMMAND_ID);

    expect(navigations).toEqual(["/projects/project-1/settings"]);
    expect(commandPaletteRequests).toBe(1);
    expect(shortcutHelpRequests).toBe(1);
    expect(shell.layout.getLayout().activeWidgetId).toBe(PROJECT_SETTINGS_WIDGET_ID);
    expect(shell.layout.getLayout().activeResourceUri).toBe("pstdio://project/project-1");
    expect(shell.layout.getLayout().areas["main-left"].widgets).toEqual([]);

    shell.dispose();

    expect(shell.commands.getCommand(PROJECT_OPEN_SETTINGS_COMMAND_ID)).toBeUndefined();
  });

  it("can disable the project navigation tree for nested settings shells", () => {
    const shell = createDashboardProjectShell({
      projectId: "project-1",
      projectName: "Prompt Studio",
      navigate: () => {},
      showProjectNavigationTree: false,
    });

    expect(shell.trees.getTreeView(PROJECT_NAVIGATION_TREE_ID)).toBeUndefined();
    expect(shell.layout.getLayout().areas["left-header"].widgets).toEqual([]);
    expect(shell.layout.getLayout().areas.left.widgets).toEqual([]);
    expect(shell.layout.getLayout().areas["main-left"].widgets).toEqual([]);

    shell.dispose();
  });
});
