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

    expect(workbench.keybindings.listKeybindings()).toMatchObject([
      { commandId: "workbench.toggleCommandPalette" },
      { commandId: "workbench.toggleSideBar" },
      { commandId: "workbench.togglePanel" },
      { commandId: "workbench.focusMain" },
      { commandId: "workbench.focusSideBar" },
      { commandId: "workbench.closeActiveWidget" },
    ]);
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
