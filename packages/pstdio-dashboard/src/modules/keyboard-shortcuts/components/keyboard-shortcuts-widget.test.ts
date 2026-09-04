import { describe, expect, test } from "bun:test";
import { createWorkbench } from "@pstdio/workbench";
import { buildShortcutEntries } from "./keyboard-shortcuts-widget";

describe("buildShortcutEntries", () => {
  test("lists registered shortcuts even when their context is inactive", () => {
    const workbench = createWorkbench();
    workbench.commands.registerCommand({ id: "active", label: "Active" }, { execute: () => undefined });
    workbench.commands.registerCommand({ id: "inactive", label: "Inactive" }, { execute: () => undefined });
    workbench.keybindings.registerKeybinding({ action: { kind: "command", commandId: "active" }, keybinding: "Mod+A" });
    workbench.keybindings.registerKeybinding({
      action: { kind: "command", commandId: "inactive" },
      keybinding: "Mod+I",
      when: "inputFocus",
    });

    const activeCommandIds = workbench.keybindings
      .listActiveKeybindings()
      .flatMap((binding) => (binding.action.kind === "command" ? [binding.action.commandId] : []));
    expect(activeCommandIds).toContain("active");
    expect(activeCommandIds).not.toContain("inactive");
    expect(buildShortcutEntries(workbench).map((entry) => entry.label)).toEqual(
      expect.arrayContaining(["Active", "Inactive"]),
    );
  });
});
