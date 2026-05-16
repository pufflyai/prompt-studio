import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "../../core";
import { createWorkbenchHotkeyRegistrations } from "./workbench-keybinding-dispatcher";

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
});
