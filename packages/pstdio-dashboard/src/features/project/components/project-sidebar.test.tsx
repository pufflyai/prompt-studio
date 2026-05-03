import { describe, expect, it } from "bun:test";
import { KanbanSquare } from "lucide-react";
import { isValidElement } from "react";
import { getShortcutDefinition } from "@/features/shortcuts/shortcut-registry";
import {
  buildProjectSidebarSections,
  buildSidebarShortcutMenuItems,
  getSidebarHelpShortcutDefinitions,
  resolveActiveNodeId,
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

  it("adds extension navigation entries for the project sidebar slot", () => {
    const sections = buildProjectSidebarSections({
      projectId: "project-1",
      ticketsLabel: "Tickets",
      searchLabel: "Search",
      extensionNavigation: [
        {
          id: "lab",
          extensionId: "extension-lab",
          slotId: "project.sidebarNav",
          label: "Lab",
          route: "lab",
          icon: "flask-conical",
        },
        {
          id: "workspace-lab",
          extensionId: "extension-lab",
          slotId: "workspace.tabs",
          label: "Workspace Lab",
          route: "workspace-lab",
        },
      ],
    });

    expect(sections[0]?.nodes.map((node) => node.id)).toEqual(["search", "tickets", "extension:lab"]);
    expect(sections[0]?.nodes[2]?.href).toBe("/projects/project-1/lab");
    expect(sections[0]?.nodes[2]?.navigationIntent).toEqual({
      id: "extension-navigation",
      payload: { id: "lab" },
    });
  });

  it("marks extension navigation active on matching project routes", () => {
    expect(
      resolveActiveNodeId("/projects/project-1/lab", "project-1", [
        {
          id: "lab",
          extensionId: "extension-lab",
          slotId: "project.sidebarNav",
          label: "Lab",
          route: "lab",
        },
      ]),
    ).toBe("extension:lab");
  });

  it("only exposes keyboard shortcuts in the help menu shortcut section", () => {
    expect(SIDEBAR_HELP_SHORTCUT_IDS).toEqual(["open-shortcut-help"]);
  });

  it("maps help menu shortcuts from the shared registry", () => {
    const shortcutIds = SIDEBAR_HELP_SHORTCUT_IDS;
    const definitions = getSidebarHelpShortcutDefinitions();

    expect(definitions).toHaveLength(shortcutIds.length);

    definitions.forEach((definition, index) => {
      const expected = getShortcutDefinition(shortcutIds[index]);
      if (!definition || !expected) {
        throw new Error("Expected sidebar shortcut definition to exist.");
      }

      expect(definition.id).toBe(shortcutIds[index]);
      expect(definition.binding).toEqual(expected.binding);
    });
  });

  it("renders kbd labels for shortcut-backed help menu actions", () => {
    const menuItems = buildSidebarShortcutMenuItems([
      {
        id: "create-ticket",
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
