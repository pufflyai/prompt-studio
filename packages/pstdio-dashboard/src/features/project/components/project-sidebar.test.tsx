import { describe, expect, it } from "bun:test";
import { KanbanSquare } from "lucide-react";
import { isValidElement } from "react";
import {
  DASHBOARD_OPEN_SHORTCUT_HELP_COMMAND_ID,
  DASHBOARD_PROJECT_SHORTCUTS,
} from "@/shared/shell/dashboard-project-shell";
import {
  buildProjectSidebarSections,
  buildSidebarShortcutMenuItems,
  getSidebarHelpShortcutDefinitions,
  SIDEBAR_HELP_SHORTCUT_IDS,
} from "./project-sidebar";

describe("project-sidebar shortcuts", () => {
  it("adds a search entry that opens the command palette", () => {
    const sections = buildProjectSidebarSections({
      projectId: "project-1",
      ticketsLabel: "Tickets",
      searchLabel: "Search",
    });

    expect(sections[0]?.nodes.map((node) => node.id)).toEqual(["search", "tickets"]);
    expect(sections[0]?.nodes[0]?.navigationIntent).toEqual({ id: "command-palette" });
  });

  it("keeps the root sidebar focused on search and tickets", () => {
    const sections = buildProjectSidebarSections({
      projectId: "project-1",
      ticketsLabel: "Tickets",
      searchLabel: "Search",
    });

    expect(sections[0]?.nodes.map((node) => node.id)).not.toContain("sessions");
  });

  it("only exposes keyboard shortcuts in the help menu shortcut section", () => {
    expect(SIDEBAR_HELP_SHORTCUT_IDS).toEqual([DASHBOARD_OPEN_SHORTCUT_HELP_COMMAND_ID]);
  });

  it("maps help menu shortcuts from the shell shortcut descriptors", () => {
    const shortcutIds = SIDEBAR_HELP_SHORTCUT_IDS;
    const definitions = getSidebarHelpShortcutDefinitions();

    expect(definitions).toHaveLength(shortcutIds.length);

    definitions.forEach((definition, index) => {
      const expected = DASHBOARD_PROJECT_SHORTCUTS.find((shortcut) => shortcut.commandId === shortcutIds[index]);
      if (!definition || !expected) {
        throw new Error("Expected sidebar shortcut definition to exist.");
      }

      expect(definition.id).toBe(expected.commandId);
      expect(definition.binding).toEqual(expected.keybinding);
    });
  });

  it("renders kbd labels for shortcut-backed help menu actions", () => {
    const menuItems = buildSidebarShortcutMenuItems([
      {
        id: "project.createTicket",
        primaryLabel: "Create ticket",
        binding: "Ctrl+Shift+C",
        leftIcon: KanbanSquare,
        onClick: () => {},
      },
    ]);

    const shortcutLabel = menuItems[0]?.shortcutLabel;

    expect(menuItems[0]?.primaryLabel).toBe("Create ticket");
    expect(isValidElement(shortcutLabel)).toBe(true);
    expect(
      shortcutLabel && "props" in shortcutLabel ? (shortcutLabel.props as { binding?: string }).binding : null,
    ).toBe("Ctrl+Shift+C");
  });
});
