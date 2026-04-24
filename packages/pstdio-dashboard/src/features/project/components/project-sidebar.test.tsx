import { describe, expect, it } from "bun:test";
import { KanbanSquare } from "lucide-react";
import { isValidElement } from "react";
import { getShortcutDefinition } from "@/features/shortcuts/shortcut-registry";
import {
  buildSidebarShortcutMenuItems,
  getSidebarHelpShortcutDefinitions,
  SIDEBAR_HELP_SHORTCUT_IDS,
} from "./project-sidebar";

describe("project-sidebar shortcuts", () => {
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
        binding: "C",
        leftIcon: KanbanSquare,
        onClick: () => {},
      },
    ]);

    const shortcutLabel = menuItems[0]?.shortcutLabel;

    expect(menuItems[0]?.primaryLabel).toBe("Create ticket");
    expect(isValidElement(shortcutLabel)).toBe(true);
    expect(
      shortcutLabel && "props" in shortcutLabel ? (shortcutLabel.props as { binding?: string }).binding : null,
    ).toBe("C");
  });
});
