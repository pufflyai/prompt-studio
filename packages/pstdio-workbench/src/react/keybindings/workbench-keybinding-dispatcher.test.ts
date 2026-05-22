import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "../../core";
import { createWorkbenchHotkeyRegistrations, normalizeWorkbenchKeybinding } from "./workbench-keybinding-dispatcher";

describe("createWorkbenchHotkeyRegistrations", () => {
  test("maps active keybindings to command-backed hotkey registrations", async () => {
    const workbench = createWorkbenchCore();
    let executed = false;

    workbench.commands.registerCommand(
      { id: "project.refresh", label: "Refresh project" },
      { execute: () => (executed = true) },
    );
    workbench.keybindings.registerKeybinding({
      commandId: "project.refresh",
      keybinding: "mod+r",
      when: "activeWorkbenchMode == project",
    });
    workbench.context.set("activeWorkbenchMode", "project");

    const registrations = createWorkbenchHotkeyRegistrations({ workbench });

    expect(registrations).toContainEqual(
      expect.objectContaining({
        commandId: "project.refresh",
        hotkey: "Mod+R",
        enabled: true,
        ignoreInputs: true,
      }),
    );

    await registrations.find((registration) => registration.commandId === "project.refresh")?.execute();

    expect(executed).toBe(true);
  });

  test("normalizes keybinding chords for hotkey registrations", () => {
    expect(normalizeWorkbenchKeybinding(["ctrl+shift+s", "n"])).toEqual(["Control+Shift+S", "N"]);
    expect(normalizeWorkbenchKeybinding("ctrl+shift+s n")).toEqual(["Control+Shift+S", "N"]);
  });

  test("maps chord keybindings to command-backed hotkey registrations", () => {
    const workbench = createWorkbenchCore();

    workbench.commands.registerCommand({ id: "sessions.new", label: "New Session" }, { execute: () => undefined });
    workbench.keybindings.registerKeybinding({
      commandId: "sessions.new",
      keybinding: "Ctrl+Shift+S N",
    });

    expect(createWorkbenchHotkeyRegistrations({ workbench })).toContainEqual(
      expect.objectContaining({
        commandId: "sessions.new",
        hotkey: ["Control+Shift+S", "N"],
      }),
    );
  });

  test("filters registrations to allowed command ids", () => {
    const workbench = createWorkbenchCore();

    const registrations = createWorkbenchHotkeyRegistrations({
      workbench,
      commandIds: ["workbench.action.navigateBack", "workbench.action.navigateForward"],
    });

    expect(registrations.map((registration) => registration.commandId).sort()).toEqual([
      "workbench.action.navigateBack",
      "workbench.action.navigateForward",
    ]);
  });
});
