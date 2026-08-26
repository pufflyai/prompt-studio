import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "@pstdio/workbench";
import { buildShortcutEntries } from "./keyboard-shortcuts-widget";

describe("buildShortcutEntries", () => {
  test("lists registered shortcuts even when their context is inactive", () => {
    const workbench = createWorkbenchCore();
    workbench.commands.registerCommand({ id: "active", label: "Active" }, { execute: () => undefined });
    workbench.commands.registerCommand({ id: "inactive", label: "Inactive" }, { execute: () => undefined });
    workbench.keybindings.registerKeybinding({ commandId: "active", keybinding: "Mod+A" });
    workbench.keybindings.registerKeybinding({
      commandId: "inactive",
      keybinding: "Mod+I",
      when: "inputFocus",
    });

    const activeCommandIds = workbench.keybindings.listActiveKeybindings().map((binding) => binding.commandId);
    expect(activeCommandIds).toContain("active");
    expect(activeCommandIds).not.toContain("inactive");
    expect(buildShortcutEntries(workbench).map((entry) => entry.label)).toEqual(
      expect.arrayContaining(["Active", "Inactive"]),
    );
  });
});
