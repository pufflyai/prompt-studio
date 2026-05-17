import { describe, expect, test } from "bun:test";
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

    await workbench.commands.executeCommand("workbench.focusPanel");
    expect(workbench.focus.getActiveArea()).toBe("panel");
    expect(workbench.context.get("panelFocus")).toBe(true);

    const keybindings = workbench.keybindings.listKeybindings();

    expect(keybindings).toMatchObject([
      { commandId: "workbench.toggleCommandPalette" },
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
      keybinding: "alt+3",
      when: "!inputFocus",
    });
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
});
