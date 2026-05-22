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

  test("toggles the active resource through built-in favorite commands", async () => {
    const workbench = createWorkbenchCore();
    const resource = {
      kind: "dashboard-view",
      uri: "pstdio://dashboard/tickets",
      label: "Tickets",
      icon: "KanbanSquare",
    };

    workbench.layout.registerWidget({
      id: "dashboard.tickets",
      title: "Tickets",
      area: "main",
      rendererId: "dashboard.tickets",
    });

    expect(workbench.commands.isCommandEnabled("favorites.toggleCurrentResource")).toBe(false);

    workbench.layout.openWidget("dashboard.tickets", { resource });

    expect(workbench.commands.isCommandEnabled("favorites.toggleCurrentResource")).toBe(true);
    await workbench.commands.executeCommand("favorites.addCurrentResource");
    await expect(workbench.favorites.isFavorited(resource, { scope: "user" })).resolves.toBe(true);

    await workbench.commands.executeCommand("favorites.toggleCurrentResource");

    await expect(workbench.favorites.isFavorited(resource, { scope: "user" })).resolves.toBe(false);
  });

  test("uses the active resource favorite scope for built-in favorite commands", async () => {
    const workbench = createWorkbenchCore();
    const resource = {
      kind: "dashboard-view",
      uri: "pstdio://dashboard/tickets",
      label: "Tickets",
      metadata: {
        favoriteScope: { scope: "project", projectId: "project-1" },
      },
    };

    workbench.layout.registerWidget({
      id: "dashboard.tickets",
      title: "Tickets",
      area: "main",
      rendererId: "dashboard.tickets",
    });
    workbench.layout.openWidget("dashboard.tickets", { resource });

    await workbench.commands.executeCommand("favorites.addCurrentResource");

    await expect(workbench.favorites.isFavorited(resource, { scope: "project", projectId: "project-1" })).resolves.toBe(
      true,
    );
    await expect(workbench.favorites.isFavorited(resource, { scope: "user" })).resolves.toBe(false);

    await workbench.commands.executeCommand("favorites.removeCurrentResource");

    await expect(workbench.favorites.isFavorited(resource, { scope: "project", projectId: "project-1" })).resolves.toBe(
      false,
    );
  });
});
