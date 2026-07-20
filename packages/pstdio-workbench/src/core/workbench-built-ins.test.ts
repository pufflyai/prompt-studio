import { describe, expect, test } from "bun:test";
import { findReservedKeybindingConflict } from "pstdio-extensions";
import { workbenchCommandPaletteMenuPath } from "./registries/menus/workbench-menu-paths";
import { createWorkbenchCore } from "./workbench-core";

describe("workbench built-ins", () => {
  test("registers command-backed chrome actions and default keybindings", async () => {
    const workbench = createWorkbenchCore();

    await workbench.commands.executeCommand("workbench.toggleSideBar");
    expect(workbench.panels.isOpen("sidebar")).toBe(false);
    expect(workbench.layout.getLayout().regions.sidebar.visible).toBe(false);

    await workbench.commands.executeCommand("workbench.toggleCommandPalette");
    expect(workbench.commandPalette.isOpen()).toBe(true);

    await workbench.commands.executeCommand("workbench.action.changeTheme");
    expect(workbench.commandPalette.getView()).toBe("theme");

    await workbench.commands.executeCommand("workbench.action.showCommands");
    expect(workbench.commandPalette.getInitialQuery()).toBe("> ");

    const keybindings = workbench.keybindings.listKeybindings();

    expect(keybindings).toMatchObject([
      { commandId: "workbench.toggleCommandPalette" },
      { commandId: "workbench.action.showCommands" },
      { commandId: "workbench.action.changeTheme" },
      { commandId: "workbench.action.navigateBack" },
      { commandId: "workbench.action.navigateForward" },
      { commandId: "workbench.toggleSideBar" },
    ]);
    expect(keybindings.find((keybinding) => keybinding.commandId === "workbench.toggleCommandPalette")).toMatchObject({
      commandId: "workbench.toggleCommandPalette",
      keybinding: "Mod+K",
    });
    expect(keybindings.find((keybinding) => keybinding.commandId === "workbench.action.showCommands")).toMatchObject({
      commandId: "workbench.action.showCommands",
      keybinding: "Alt+Shift+K",
    });
    expect(keybindings.find((keybinding) => keybinding.commandId === "workbench.action.changeTheme")).toMatchObject({
      commandId: "workbench.action.changeTheme",
      keybinding: "Alt+Shift+T",
    });
    expect(keybindings.find((keybinding) => keybinding.commandId === "workbench.action.navigateBack")).toMatchObject({
      commandId: "workbench.action.navigateBack",
      keybinding: "Alt+Shift+ArrowLeft",
    });
    expect(keybindings.find((keybinding) => keybinding.commandId === "workbench.action.navigateForward")).toMatchObject(
      {
        commandId: "workbench.action.navigateForward",
        keybinding: "Alt+Shift+ArrowRight",
      },
    );
  });

  test("built-in chords avoid known reserved browser shortcuts on every platform", () => {
    const workbench = createWorkbenchCore();

    for (const keybinding of workbench.keybindings.listKeybindings()) {
      // Only the first step of a sequence is typed in isolation, so it is the
      // step that can collide with browser/OS chords. Later steps fire only
      // after the workbench has captured the sequence prefix.
      const firstStep = Array.isArray(keybinding.keybinding) ? keybinding.keybinding[0] : keybinding.keybinding;
      if (!firstStep) continue;
      for (const platform of ["mac", "linux", "win"] as const) {
        expect({
          commandId: keybinding.commandId,
          chord: firstStep,
          platform,
          conflict: findReservedKeybindingConflict(firstStep, platform),
        }).toMatchObject({ conflict: undefined });
      }
    }
  });

  test("built-in keybindings are not ambiguous sequence prefixes", () => {
    const workbench = createWorkbenchCore();
    const keybindings = workbench.keybindings.listKeybindings();

    for (const keybinding of keybindings) {
      const sequence = Array.isArray(keybinding.keybinding) ? keybinding.keybinding : [keybinding.keybinding];
      for (const otherKeybinding of keybindings) {
        if (keybinding.commandId === otherKeybinding.commandId) continue;

        const otherSequence = Array.isArray(otherKeybinding.keybinding)
          ? otherKeybinding.keybinding
          : [otherKeybinding.keybinding];
        const isPrefix =
          sequence.length < otherSequence.length && sequence.every((step, index) => step === otherSequence[index]);

        expect({
          commandId: keybinding.commandId,
          keybinding: keybinding.keybinding,
          ambiguousWith: otherKeybinding.commandId,
          otherKeybinding: otherKeybinding.keybinding,
          isPrefix,
        }).toMatchObject({ isPrefix: false });
      }
    }
  });

  test("does not register removed default workbench commands", () => {
    const workbench = createWorkbenchCore();
    const removedCommandIds = [
      "workbench.focusMain",
      "workbench.focusSideBar",
      "workbench.focusPanel",
      "workbench.action.navigatePrevious",
      "workbench.action.reopenLastClosed",
      "workbench.closeActiveWidget",
    ];

    const commandIds = workbench.layout.listMenuItems(workbenchCommandPaletteMenuPath).map((item) => item.commandId);
    const keybindingCommandIds = workbench.keybindings.listKeybindings().map((keybinding) => keybinding.commandId);

    for (const commandId of removedCommandIds) {
      expect(workbench.commands.getCommand(commandId)).toBeUndefined();
      expect(commandIds).not.toContain(commandId);
      expect(keybindingCommandIds).not.toContain(commandId);
    }
  });

  test("switches modes through a built-in command", async () => {
    const workbench = createWorkbenchCore();

    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    workbench.modes.registerMode({ id: "pstdio.extension-lab.lab", label: "Lab", activate: () => undefined });
    workbench.modes.setActiveMode("project");

    await workbench.commands.executeCommand("workbench.action.switchMode", { modeId: "pstdio.extension-lab.lab" });

    expect(workbench.modes.getActiveModeId()).toBe("pstdio.extension-lab.lab");
  });

  test("opens the mode picker when switch mode runs without a mode id", async () => {
    const workbench = createWorkbenchCore();

    await workbench.commands.executeCommand("workbench.action.switchMode");

    expect(workbench.commandPalette.isOpen()).toBe(true);
    expect(workbench.commandPalette.getView()).toBe("mode");
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
