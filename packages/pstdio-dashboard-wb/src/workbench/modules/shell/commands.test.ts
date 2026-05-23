import { describe, expect, mock, test } from "bun:test";
import { createWorkbenchCore, type WorkbenchCore, workbenchCommandPaletteMenuPath } from "pstdio-workbench/core";
import { dashboardHelpMenuPath, dashboardWorkspaceMenuPath } from "../../shared/menu-paths";
import { dashboardWidgetIds } from "../../shared/widget-ids";
import { getDashboardVersionLabel, openDashboardHelpLink } from "./commands";
import { createShellModule } from "./module";

const createShellWorkbench = () => {
  const workbench = createWorkbenchCore();
  workbench.registerModule(createShellModule());
  return workbench;
};

const resolveMenuCommandIds = (workbench: WorkbenchCore) =>
  workbench.layout.listMenuItems(dashboardHelpMenuPath).map((item) => item.commandId);

describe("dashboard workbench help menu commands", () => {
  test("matches the dashboard sidebar help menu actions", () => {
    const workbench = createShellWorkbench();

    expect(resolveMenuCommandIds(workbench)).toEqual([
      "dashboard.openShortcuts",
      "dashboard.openDocs",
      "dashboard.openDiscord",
      "dashboard.productInfo",
    ]);
    expect(workbench.commands.getCommand("dashboard.openShortcuts")?.command.icon).toBe("CircleHelp");
    expect(workbench.commands.getCommand("dashboard.openDocs")?.command.icon).toBe("BookOpen");
    expect(workbench.commands.getCommand("dashboard.openDiscord")?.command.icon).toBe("MessageCircle");
    expect(workbench.commands.getCommand("dashboard.productInfo")?.command.label).toBe("Prompt Studio");
  });

  test("registers the delete workspace action in the workspace header menu", () => {
    const workbench = createShellWorkbench();

    expect(workbench.layout.listMenuItems(dashboardWorkspaceMenuPath).map((item) => item.commandId)).toEqual([
      "dashboard.deleteWorkspace",
    ]);
    expect(workbench.commands.getCommand("dashboard.deleteWorkspace")?.command.icon).toBe("Trash2");
  });

  test("does not register removed extension demo commands", () => {
    const workbench = createShellWorkbench();

    expect(workbench.commands.getCommand("dashboard.openRepoHealth")).toBeUndefined();
    expect(workbench.commands.getCommand("dashboard.runHealthScan")).toBeUndefined();
    expect(workbench.commands.getCommand("dashboard.sayHello")).toBeUndefined();
    expect(workbench.layout.listMenuItems(workbenchCommandPaletteMenuPath).map((item) => item.commandId)).not.toEqual(
      expect.arrayContaining(["dashboard.openRepoHealth", "dashboard.runHealthScan", "dashboard.sayHello"]),
    );
  });

  test("renders Prompt Studio as read-only product metadata", () => {
    const workbench = createShellWorkbench();

    expect(workbench.layout.listMenuItems(dashboardHelpMenuPath).at(-1)).toMatchObject({
      commandId: "dashboard.productInfo",
      label: "Prompt Studio",
      description: getDashboardVersionLabel(),
      iconSrc: "/logo.svg",
      readOnly: true,
    });
    expect(workbench.commands.isCommandEnabled("dashboard.productInfo")).toBe(false);
  });

  test("shows the dashboard keyboard shortcut on the help menu shortcut action", () => {
    const workbench = createShellWorkbench();

    expect(workbench.keybindings.listKeybindings()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          commandId: "dashboard.openShortcuts",
          keybinding: "Ctrl+Shift+H",
        }),
      ]),
    );
  });

  test("opens shortcut help in the workbench overlay", async () => {
    const workbench = createShellWorkbench();

    await workbench.commands.executeCommand("dashboard.openShortcuts");

    expect(workbench.commandPalette.isOpen()).toBe(false);
    expect(workbench.layout.getLayout().areas.overlay.widgets).toEqual([
      expect.objectContaining({ contributionId: dashboardWidgetIds.shortcutHelp }),
    ]);
  });

  test("opens the project picker in the workbench overlay", async () => {
    const workbench = createShellWorkbench();

    await workbench.commands.executeCommand("dashboard.openProjects");

    expect(workbench.layout.getLayout().areas.overlay.widgets).toEqual([
      expect.objectContaining({ contributionId: dashboardWidgetIds.projectPicker }),
    ]);
  });

  test("opens the create project flow in the workbench overlay", async () => {
    const workbench = createShellWorkbench();

    await workbench.commands.executeCommand("dashboard.createProject");

    expect(workbench.layout.getLayout().areas.overlay.widgets).toEqual([
      expect.objectContaining({ contributionId: dashboardWidgetIds.createProject }),
    ]);
  });

  test("opens external help links like the dashboard sidebar", () => {
    const open = mock();

    openDashboardHelpLink("https://example.com/docs", open);

    expect(open).toHaveBeenCalledWith("https://example.com/docs", "_blank", "noopener,noreferrer");
  });

  test("formats the dashboard version subtitle", () => {
    expect(getDashboardVersionLabel("1.2.3")).toBe("v1.2.3");
  });
});
