import { describe, expect, it } from "bun:test";
import { createShellCore } from "pstdio-shell/core";
import { createDashboardProjectShell } from "@/shared/shell/dashboard-project-shell";
import { buildShortcutHelpEntries } from "./shortcut-help-model";

describe("shortcut help model", () => {
  it("returns no static app shortcuts without a shell", () => {
    expect(buildShortcutHelpEntries()).toEqual([]);
  });

  it("builds help entries from visible active shell keybindings", () => {
    const shell = createShellCore();

    shell.commands.registerCommand(
      { id: "project.openSettings", label: "Project settings", category: "Project" },
      { execute: () => undefined },
    );
    shell.commands.registerCommand(
      { id: "project.hiddenAction", label: "Hidden action", category: "Project" },
      { execute: () => undefined, isVisible: () => false },
    );
    shell.commands.registerCommand(
      { id: "project.inactiveAction", label: "Inactive action", category: "Project" },
      { execute: () => undefined },
    );

    shell.keybindings.registerKeybinding({
      commandId: "project.openSettings",
      keybinding: "Ctrl+Shift+,",
    });
    shell.keybindings.registerKeybinding({
      commandId: "project.hiddenAction",
      keybinding: "Ctrl+Shift+X",
    });
    shell.keybindings.registerKeybinding({
      commandId: "project.inactiveAction",
      keybinding: "Ctrl+Shift+I",
      when: "workspaceFocus",
    });

    expect(buildShortcutHelpEntries(shell)).toEqual([
      {
        id: "project.openSettings:Ctrl+Shift+,",
        actionLabel: "Project settings",
        binding: "Ctrl+Shift+,",
        category: "Project",
      },
    ]);
  });

  it("shows first-party dashboard shortcuts contributed by the project shell", () => {
    const shell = createDashboardProjectShell({
      projectId: "project-1",
      navigate: () => {},
    });

    expect(buildShortcutHelpEntries(shell).map(({ actionLabel, binding }) => ({ actionLabel, binding }))).toEqual([
      { actionLabel: "Close overlay", binding: "Escape" },
      { actionLabel: "Create ticket", binding: "Ctrl+Shift+C" },
      { actionLabel: "Create session", binding: "Ctrl+Shift+S" },
      { actionLabel: "Go to tickets", binding: "Ctrl+Shift+T" },
      { actionLabel: "Command palette", binding: "Ctrl+Shift+P" },
      { actionLabel: "Run a command", binding: "Ctrl+Shift+." },
      { actionLabel: "Change theme", binding: "Ctrl+Shift+K" },
      { actionLabel: "Keyboard shortcuts", binding: "Ctrl+Shift+H" },
      { actionLabel: "Project settings", binding: "Ctrl+Shift+," },
    ]);
  });
});
