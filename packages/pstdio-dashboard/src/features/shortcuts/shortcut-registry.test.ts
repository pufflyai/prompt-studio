import { describe, expect, it } from "bun:test";
import {
  getActiveShortcutScopes,
  getShortcutDefinition,
  isEditableEventTarget,
  SHORTCUT_DEFINITIONS,
} from "./shortcut-registry";

describe("shortcut-registry", () => {
  it("includes the PS-79 v1 shortcuts", () => {
    expect(getShortcutDefinition("close-overlay")?.binding).toBe("Escape");
    expect(getShortcutDefinition("create-ticket")?.binding).toBe("C");
    expect(getShortcutDefinition("create-session")?.binding).toBe("S");
    expect(getShortcutDefinition("goto-ticket-list")?.binding).toEqual(["G", "T"]);
    expect(getShortcutDefinition("nav-previous")?.binding).toBe("[");
    expect(getShortcutDefinition("nav-next")?.binding).toBe("]");
    expect(getShortcutDefinition("open-shortcut-help")?.binding).toBe("Shift+/");
    expect(getShortcutDefinition("open-shortcut-help")?.actionLabel).toBe("Keyboard shortcuts");
    expect(SHORTCUT_DEFINITIONS).toHaveLength(7);
  });

  it("resolves active scopes for ticket and workspace routes", () => {
    expect(getActiveShortcutScopes("/projects/p1/tickets")).toEqual(["global"]);
    expect(getActiveShortcutScopes("/projects/p1/tickets/PS-12")).toEqual(["global", "ticket"]);
    expect(getActiveShortcutScopes("/projects/p1/tickets/PS-12/workspaces/PS-12_1")).toEqual([
      "global",
      "ticket",
      "workspace",
    ]);
  });

  it("returns no scopes outside project routes", () => {
    expect(getActiveShortcutScopes("/projects")).toEqual([]);
    expect(getActiveShortcutScopes("/settings")).toEqual([]);
    expect(getActiveShortcutScopes("/onboarding")).toEqual([]);
  });

  it("identifies editable event targets", () => {
    expect(isEditableEventTarget({ tagName: "INPUT", type: "text" })).toBe(true);
    expect(isEditableEventTarget({ tagName: "TEXTAREA" })).toBe(true);
    expect(isEditableEventTarget({ isContentEditable: true })).toBe(true);
    expect(isEditableEventTarget({ tagName: "INPUT", type: "button" })).toBe(false);
    expect(isEditableEventTarget({ tagName: "DIV", isContentEditable: false })).toBe(false);
  });
});
