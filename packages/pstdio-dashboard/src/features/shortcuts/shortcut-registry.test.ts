import { describe, expect, it } from "bun:test";
import { getActiveShortcutScopes, isEditableEventTarget } from "./shortcut-registry";

describe("shortcut-registry", () => {
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
    const textNodeInsideEditable = {
      nodeType: 3,
      parentElement: { isContentEditable: true },
    } as unknown as EventTarget;
    const nestedTextNodeInsideEditable = {
      nodeType: 3,
      parentElement: {
        tagName: "SPAN",
        parentElement: {
          tagName: "DIV",
          isContentEditable: true,
        },
      },
    } as unknown as EventTarget;

    expect(isEditableEventTarget({ tagName: "INPUT", type: "text" })).toBe(true);
    expect(isEditableEventTarget({ tagName: "TEXTAREA" })).toBe(true);
    expect(isEditableEventTarget({ isContentEditable: true })).toBe(true);
    expect(isEditableEventTarget(textNodeInsideEditable)).toBe(true);
    expect(isEditableEventTarget(nestedTextNodeInsideEditable)).toBe(true);
    expect(isEditableEventTarget({ tagName: "INPUT", type: "button" })).toBe(false);
    expect(isEditableEventTarget({ tagName: "DIV", isContentEditable: false })).toBe(false);
  });
});
