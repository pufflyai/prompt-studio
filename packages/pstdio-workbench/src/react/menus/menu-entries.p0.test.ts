import { expect, test } from "bun:test";
import { createWorkbench } from "../../core";
import { resolveMenuEntries } from "./menu-entries";

test("extension wrapper menus show the original action's exact-argument shortcut", () => {
  const workbench = createWorkbench();
  for (const id of ["original", "wrapper"]) workbench.commands.registerCommand({ id, label: id }, { execute() {} });
  const args = { operation: "rename" };
  workbench.keybindings.registerKeybinding({
    action: { kind: "command", commandId: "original", args },
    keybinding: "Alt+R",
  });
  workbench.layout.registerMenuItem(["extension"], { commandId: "wrapper", sourceCommandId: "original", args });
  expect(resolveMenuEntries({ workbench, menuPath: ["extension"] })[0]).toMatchObject({
    binding: "Alt+R",
    action: { commandId: "original", args },
  });
});

test("ordinary menu hints avoid measuring unrelated panel shortcuts", () => {
  const workbench = createWorkbench();
  workbench.commands.registerCommand({ id: "rename", label: "Rename" }, { execute() {} });
  workbench.keybindings.registerKeybinding({
    action: { kind: "command", commandId: "rename" },
    keybinding: "Alt+R",
  });
  workbench.layout.registerMenuItem(["extension"], { commandId: "rename" });
  workbench.keyboard.registerVisibleRegion("main", () => {
    throw new Error("Rendering an unrelated menu must not measure panel navigation");
  });
  expect(resolveMenuEntries({ workbench, menuPath: ["extension"] })[0]?.binding).toBe("Alt+R");
});
