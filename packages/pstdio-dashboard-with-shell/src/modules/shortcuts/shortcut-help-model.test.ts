import { describe, expect, it } from "bun:test";
import { createShellCore } from "pstdio-shell/core";
import { buildShortcutHelpEntries } from "./shortcut-help-model";

describe("buildShortcutHelpEntries", () => {
  it("returns one entry per visible active keybinding with command metadata", () => {
    const shell = createShellCore();

    shell.commands.registerCommand(
      { id: "project.openSettings", label: "Project settings", category: "Project" },
      { execute: () => undefined },
    );
    shell.commands.registerCommand(
      { id: "project.hiddenAction", label: "Hidden action", category: "Project" },
      { execute: () => undefined, isVisible: () => false },
    );

    shell.keybindings.registerKeybinding({ commandId: "project.openSettings", keybinding: "Ctrl+Shift+," });
    shell.keybindings.registerKeybinding({ commandId: "project.hiddenAction", keybinding: "Ctrl+Shift+X" });

    expect(buildShortcutHelpEntries(shell)).toEqual([
      {
        id: "project.openSettings:Ctrl+Shift+,",
        actionLabel: "Project settings",
        binding: "Ctrl+Shift+,",
        category: "Project",
      },
    ]);
  });

  it("skips keybindings whose `when` clause excludes them from the active set", () => {
    const shell = createShellCore();

    shell.commands.registerCommand({ id: "inactive.action", label: "Inactive" }, { execute: () => undefined });
    shell.keybindings.registerKeybinding({
      commandId: "inactive.action",
      keybinding: "Ctrl+I",
      when: "neverTrue",
    });

    expect(buildShortcutHelpEntries(shell)).toEqual([]);
  });
});
