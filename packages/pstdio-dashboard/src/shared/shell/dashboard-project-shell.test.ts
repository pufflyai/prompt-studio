import { describe, expect, it } from "bun:test";
import {
  createDashboardProjectShell,
  PROJECT_NAVIGATION_TREE_ID,
  PROJECT_OPEN_SETTINGS_COMMAND_ID,
  PROJECT_RESOURCE_KIND,
  PROJECT_SETTINGS_SIDEBAR_WIDGET_ID,
  PROJECT_SETTINGS_WIDGET_ID,
} from "./dashboard-project-shell";
import { DASHBOARD_COMMAND_PALETTE_MENU } from "./menu-locations";

describe("createDashboardProjectShell", () => {
  it("registers a first-party project shell slice and opens settings through the shell", async () => {
    const navigations: string[] = [];
    const shell = createDashboardProjectShell({
      projectId: "project-1",
      projectName: "Prompt Studio",
      navigate: (path) => navigations.push(path),
    });

    expect(shell.resources.getKind(PROJECT_RESOURCE_KIND)?.source).toBe("product-module");
    expect(shell.layout.getWidget(PROJECT_SETTINGS_WIDGET_ID)?.renderer).toBe("react");
    expect(shell.layout.getWidget(PROJECT_SETTINGS_SIDEBAR_WIDGET_ID)).toMatchObject({
      area: "main-left",
      renderer: "react",
    });
    expect(shell.commands.getCommand(PROJECT_OPEN_SETTINGS_COMMAND_ID)?.command.label).toBe("Project settings");
    expect(shell.menus.listMenuActions(DASHBOARD_COMMAND_PALETTE_MENU).map((action) => action.commandId)).toEqual([
      PROJECT_OPEN_SETTINGS_COMMAND_ID,
    ]);
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

    const [root] = await shell.trees.getRoots(PROJECT_NAVIGATION_TREE_ID);

    expect(root?.resource?.uri).toBe("pstdio://project/project-1");
    const projectResource = shell.navigation.resolveLocation("pstdio://project/project-1");

    expect(projectResource).toMatchObject({
      kind: PROJECT_RESOURCE_KIND,
      id: "project-1",
      label: "Prompt Studio",
    });
    expect(shell.navigation.createHref(projectResource)).toBe("/projects/project-1/settings");

    await shell.commands.executeCommand(PROJECT_OPEN_SETTINGS_COMMAND_ID);

    expect(navigations).toEqual(["/projects/project-1/settings"]);
    expect(shell.layout.getLayout().activeWidgetId).toBe(PROJECT_SETTINGS_WIDGET_ID);
    expect(shell.layout.getLayout().activeResourceUri).toBe("pstdio://project/project-1");
    expect(shell.layout.getLayout().areas["main-left"].widgets[0]?.contributionId).toBe(
      PROJECT_SETTINGS_SIDEBAR_WIDGET_ID,
    );

    shell.dispose();

    expect(shell.commands.getCommand(PROJECT_OPEN_SETTINGS_COMMAND_ID)).toBeUndefined();
  });

  it("can host project settings navigation in the left area without the project tree", () => {
    const projectResource = { kind: PROJECT_RESOURCE_KIND, uri: "pstdio://project/project-1", id: "project-1" };
    const shell = createDashboardProjectShell({
      projectId: "project-1",
      projectName: "Prompt Studio",
      navigate: () => {},
      showProjectNavigationTree: false,
    });

    expect(shell.trees.getTreeView(PROJECT_NAVIGATION_TREE_ID)).toBeUndefined();
    expect(shell.layout.getWidget(PROJECT_SETTINGS_SIDEBAR_WIDGET_ID)).toMatchObject({
      area: "left",
      renderer: "react",
    });

    shell.layout.openWidget(PROJECT_SETTINGS_SIDEBAR_WIDGET_ID, {
      resource: projectResource,
      closable: false,
    });

    expect(shell.layout.getLayout().areas.left.widgets[0]?.contributionId).toBe(PROJECT_SETTINGS_SIDEBAR_WIDGET_ID);
    expect(shell.layout.getLayout().areas["main-left"].widgets).toEqual([]);

    shell.dispose();
  });
});
