import { describe, expect, it } from "bun:test";
import { createShellCore } from "pstdio-shell/core";
import {
  createDashboardProjectShell,
  DASHBOARD_CHANGE_THEME_KEYBINDING,
  DASHBOARD_OPEN_SHORTCUT_HELP_KEYBINDING,
  PROJECT_CREATE_SESSION_KEYBINDING,
  PROJECT_CREATE_TICKET_KEYBINDING,
  PROJECT_GO_TO_TICKETS_KEYBINDING,
} from "@/shared/shell/dashboard-project-shell";
import { DASHBOARD_COMMAND_PALETTE_MENU } from "@/shared/shell/menu-locations";
import { buildCommandPaletteEntries, filterCommandPaletteEntries } from "./command-palette";

describe("command palette shell keybindings", () => {
  it("shows the active shell keybinding for shell menu commands", () => {
    const shell = createShellCore();

    shell.commands.registerCommand(
      { id: "project.openSettings", label: "Project settings", category: "Project" },
      { execute: () => undefined },
    );
    shell.menus.registerMenuAction(DASHBOARD_COMMAND_PALETTE_MENU, { commandId: "project.openSettings" });
    shell.keybindings.registerKeybinding({
      commandId: "project.openSettings",
      keybinding: "Ctrl+Shift+,",
    });

    const entries = buildCommandPaletteEntries({
      projectId: "project-1",
      tickets: [],
      sessions: [],
      currentTheme: "pstdio-dark",
      shell,
      run: () => {},
    });

    const [entry] = filterCommandPaletteEntries(entries, "> settings");

    expect(entry?.shortcut).toBe("Ctrl+Shift+,");
  });

  it("shows first-party dashboard command keybindings from the project shell", () => {
    const shell = createDashboardProjectShell({ projectId: "project-1", navigate: () => undefined });
    const entries = buildCommandPaletteEntries({
      projectId: "project-1",
      tickets: [],
      sessions: [],
      currentTheme: "pstdio-dark",
      shell,
      run: () => {},
    });
    const shortcutByEntryId = new Map(entries.map((entry) => [entry.id, entry.shortcut]));

    expect(shortcutByEntryId.get("nav:tickets")).toBe(PROJECT_GO_TO_TICKETS_KEYBINDING);
    expect(shortcutByEntryId.get("command:create-ticket")).toBe(PROJECT_CREATE_TICKET_KEYBINDING);
    expect(shortcutByEntryId.get("command:create-session")).toBe(PROJECT_CREATE_SESSION_KEYBINDING);
    expect(shortcutByEntryId.get("command:open-shortcut-help")).toBe(DASHBOARD_OPEN_SHORTCUT_HELP_KEYBINDING);
    expect(shortcutByEntryId.get("command:change-theme")).toBe(DASHBOARD_CHANGE_THEME_KEYBINDING);
    shell.dispose();
  });
});
