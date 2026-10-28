import { expect, test } from "bun:test";
import { createWorkbench } from "../../workbench-core";
import { createShortcutReference } from "./shortcut-reference";

test("the shortcut reference combines alternative chords for one resource action", () => {
  const core = createWorkbench();
  core.commands.registerCommand({ id: "sessions", label: "Go to sessions", category: "Sessions" }, { execute() {} });
  const action = { kind: "command" as const, commandId: "sessions" };
  core.keybindings.registerKeybinding({ action, keybinding: "Alt+Shift+S" });
  core.keybindings.registerKeybinding({ action, keybinding: "S", layer: "go" });
  const entries = createShortcutReference(core, core.keyboard.catalog()).filter((entry) => entry.group === "Sessions");
  expect(entries).toHaveLength(1);
  expect(entries[0]!.shortcuts.map((shortcut) => shortcut.keys)).toEqual([["ALT+SHIFT+S"], ["G", "S"]]);
});

test("creation variants keep their identities and group with the resource's commands", () => {
  const core = createWorkbench();
  core.commands.registerCommand({ id: "create-session", label: "New session", category: "Sessions" }, { execute() {} });
  for (const provider of ["one", "two"])
    core.keybindings.registerKeybinding({
      action: { kind: "command", commandId: "create-session", args: { provider } },
      keybinding: "S",
      layer: "create",
    });
  core.commands.registerCommand({ id: "internal", label: "Internal request", category: "Sessions" }, { execute() {} });
  expect(
    createShortcutReference(core, core.keyboard.catalog()).filter((entry) => entry.group === "Sessions"),
  ).toHaveLength(2);
});

test("extension shortcuts group under their registered resource kind", () => {
  const core = createWorkbench();
  core.resources.registerKind({ kind: "note", label: "Notes", extensionId: "acme.notes" });
  core.commands.registerCommand({ id: "note", label: "New note" }, { execute() {} });
  core.keybindings.registerKeybinding({
    sourceExtensionId: "acme.notes",
    action: { kind: "command", commandId: "note" },
    keybinding: "N",
    layer: "create",
  });
  expect(
    createShortcutReference(core, core.keyboard.catalog()).find((entry) => entry.label === "New note")?.group,
  ).toBe("Notes");
});
