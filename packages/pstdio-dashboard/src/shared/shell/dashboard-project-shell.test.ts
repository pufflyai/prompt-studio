import { describe, expect, it } from "bun:test";
import {
  createDashboardProjectShell,
  PROJECT_NAVIGATION_TREE_ID,
  PROJECT_OPEN_SETTINGS_COMMAND_ID,
  PROJECT_RESOURCE_KIND,
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
    expect(shell.commands.getCommand(PROJECT_OPEN_SETTINGS_COMMAND_ID)?.command.label).toBe("Project settings");
    expect(shell.menus.listMenuActions(DASHBOARD_COMMAND_PALETTE_MENU).map((action) => action.commandId)).toEqual([
      PROJECT_OPEN_SETTINGS_COMMAND_ID,
    ]);

    const [root] = await shell.trees.getRoots(PROJECT_NAVIGATION_TREE_ID);

    expect(root?.resource?.uri).toBe("pstdio://project/project-1");

    await shell.commands.executeCommand(PROJECT_OPEN_SETTINGS_COMMAND_ID);

    expect(navigations).toEqual(["/projects/project-1/settings"]);
    expect(shell.layout.getLayout().activeWidgetId).toBe(PROJECT_SETTINGS_WIDGET_ID);
    expect(shell.layout.getLayout().activeResourceUri).toBe("pstdio://project/project-1");

    shell.dispose();

    expect(shell.commands.getCommand(PROJECT_OPEN_SETTINGS_COMMAND_ID)).toBeUndefined();
  });
});
