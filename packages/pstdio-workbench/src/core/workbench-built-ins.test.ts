import { describe, expect, test } from "bun:test";
import { workbenchCommandPaletteMenuPath } from "./registries/menus/workbench-menu-paths";
import { createWorkbenchCore } from "./workbench-core";

describe("workbench built-ins", () => {
  test("registers command-backed chrome actions and default keybindings", async () => {
    const workbench = createWorkbenchCore();

    await workbench.commands.executeCommand("workbench.toggleSideBar");
    expect(workbench.panels.isOpen("left")).toBe(false);
    expect(workbench.layout.getLayout().areas.left.visible).toBe(false);

    await workbench.commands.executeCommand("workbench.focusMain");
    expect(workbench.focus.getActiveArea()).toBe("main");
    expect(workbench.context.get("mainFocus")).toBe(true);

    await workbench.commands.executeCommand("workbench.toggleCommandPalette");
    expect(workbench.commandPalette.isOpen()).toBe(true);

    await workbench.commands.executeCommand("workbench.action.changeTheme");
    expect(workbench.commandPalette.getView()).toBe("theme");

    await workbench.commands.executeCommand("workbench.action.showCommands");
    expect(workbench.commandPalette.getInitialQuery()).toBe("> ");

    await workbench.commands.executeCommand("workbench.focusPanel");
    expect(workbench.focus.getActiveArea()).toBe("panel");
    expect(workbench.context.get("panelFocus")).toBe(true);

    const keybindings = workbench.keybindings.listKeybindings();

    expect(keybindings).toMatchObject([
      { commandId: "workbench.toggleCommandPalette" },
      { commandId: "workbench.action.showCommands" },
      { commandId: "workbench.action.changeTheme" },
      { commandId: "workbench.action.navigateBack" },
      { commandId: "workbench.action.navigateForward" },
      { commandId: "workbench.action.navigatePrevious" },
      { commandId: "workbench.action.reopenLastClosed" },
      { commandId: "workbench.toggleSideBar" },
      { commandId: "workbench.togglePanel" },
      { commandId: "workbench.focusMain" },
      { commandId: "workbench.focusSideBar" },
      { commandId: "workbench.focusPanel" },
      { commandId: "workbench.closeActiveWidget" },
    ]);
    expect(keybindings.find((keybinding) => keybinding.commandId === "workbench.focusPanel")).toMatchObject({
      commandId: "workbench.focusPanel",
      keybinding: "Ctrl+Shift+3",
      when: "!inputFocus",
    });
    expect(keybindings.find((keybinding) => keybinding.commandId === "workbench.toggleCommandPalette")).toMatchObject({
      commandId: "workbench.toggleCommandPalette",
      keybinding: "Ctrl+Shift+P",
    });
    expect(keybindings.find((keybinding) => keybinding.commandId === "workbench.action.showCommands")).toMatchObject({
      commandId: "workbench.action.showCommands",
      keybinding: "Ctrl+Shift+.",
    });
    for (const keybinding of keybindings) {
      const firstStep = Array.isArray(keybinding.keybinding) ? keybinding.keybinding[0] : keybinding.keybinding;
      expect(firstStep?.startsWith("Ctrl+Shift+")).toBe(true);
    }
  });

  test("closes the active closable widget through a built-in command", async () => {
    const workbench = createWorkbenchCore();

    workbench.layout.registerWidget({
      id: "project.details",
      title: "Project details",
      area: "main",
      closable: true,
      rendererId: "project.details",
    });
    workbench.layout.openWidget("project.details");

    await workbench.commands.executeCommand("workbench.closeActiveWidget");

    expect(workbench.layout.getLayout().areas.main.widgets).toEqual([]);
  });

  test("switches modes through a built-in command", async () => {
    const workbench = createWorkbenchCore();

    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    workbench.modes.registerMode({ id: "pstdio.extension-lab.lab", label: "Lab", activate: () => undefined });
    workbench.modes.setActiveMode("project");

    await workbench.commands.executeCommand("workbench.action.switchMode", { modeId: "pstdio.extension-lab.lab" });

    expect(workbench.modes.getActiveModeId()).toBe("pstdio.extension-lab.lab");
  });

  test("switch mode command rejects unknown mode ids without mutating active state", async () => {
    const workbench = createWorkbenchCore();

    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    workbench.modes.setActiveMode("project");

    await expect(
      workbench.commands.executeCommand("workbench.action.switchMode", { modeId: "does-not-exist" }),
    ).rejects.toThrow("Workbench mode not registered: does-not-exist");
    expect(workbench.modes.getActiveModeId()).toBe("project");
  });

  test("does not register collection persistence commands", () => {
    const workbench = createWorkbenchCore();
    const commandIds = workbench.layout.listMenuItems(workbenchCommandPaletteMenuPath).map((item) => item.commandId);

    expect(workbench.commands.getCommand("favorites.toggleCurrentResource")).toBeUndefined();
    expect(workbench.commands.getCommand("savedViews.create")).toBeUndefined();
    expect(commandIds).not.toContain("favorites.toggleCurrentResource");
    expect(commandIds).not.toContain("favorites.addCurrentResource");
    expect(commandIds).not.toContain("favorites.removeCurrentResource");
    expect(commandIds).not.toContain("favorites.clearMissing");
  });
});
