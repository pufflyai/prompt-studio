import { expect, test } from "bun:test";
import { getNavigationTargetKey } from "../../registries/navigation/navigation-target-key";
import { createWorkbench } from "../../workbench-core";
import { directShortcutHint } from "./shortcut-catalog";
import { shortcutOpeningChord } from "./shortcut-menu";

test("direct tooltip hints inspect only their action and follow its current availability", () => {
  const core = createWorkbench();
  const action = { kind: "command" as const, commandId: "hinted" };
  core.commands.registerCommand({ id: "hinted", label: "Hinted" }, { execute() {} });
  core.keybindings.registerKeybinding({ action, keybinding: "Alt+J", when: "available" });
  core.context.set("available", true);
  expect(directShortcutHint(core, action)).toBe(core.keyboard.hints().get(getNavigationTargetKey(action)));
  core.commands.registerCommand(
    { id: "unrelated", label: "Unrelated" },
    {
      execute() {},
      isVisible: () => {
        throw new Error("An unrelated action must not delay a tooltip");
      },
    },
  );
  expect(directShortcutHint(core, action)).toBe("Alt+J");
  core.context.set("available", false);
  expect(directShortcutHint(core, action)).toBeUndefined();
});

test("shortcut mode only lists groups with available actions", () => {
  const core = createWorkbench();
  core.commands.registerCommand({ id: "create-record", label: "Create record" }, { execute() {} });
  core.keybindings.registerKeybinding({
    action: { kind: "command", commandId: "create-record" },
    keybinding: "R",
    layer: "create",
  });
  core.keyboard.open();
  expect(core.keyboard.entries().map((entry) => entry.key)).toEqual(["C"]);
});

test("direct page navigation has a Go to label without a second Go binding", () => {
  const core = createWorkbench();
  core.keybindings.registerKeybinding({
    id: "notes",
    label: "Notes",
    action: { kind: "page", page: { kind: "page", id: "notes", extensionId: "acme.notes" } },
    keybinding: "Alt+Shift+O",
  });
  const shortcuts = core.keyboard.catalog().filter((entry) => entry.id === "notes");
  expect(shortcuts).toHaveLength(1);
  expect(shortcuts[0]?.label).toBe("Go to notes");
});

test("many shortcut hints share availability evaluation until their context changes", () => {
  const core = createWorkbench();
  let reads = 0;
  core.commands.registerCommand(
    { id: "expensive", label: "Expensive action" },
    {
      execute() {},
      isVisible: () => {
        reads++;
        return !core.context.get("hidden");
      },
    },
  );
  const action = { kind: "command" as const, commandId: "expensive" };
  core.keybindings.registerKeybinding({ action, keybinding: "Q", layer: "go" });
  core.keyboard.open();
  for (let index = 0; index < 50; index++) core.keyboard.hint(action);
  expect(reads).toBe(1);
  core.context.set("hidden", true);
  expect(core.keyboard.hint(action)).toBeUndefined();
  expect(reads).toBe(2);
});

test("extension actions use shared groups and only advertise pressable keys", async () => {
  const core = createWorkbench();
  const action = { kind: "command" as const, commandId: "open-lab" };
  core.commands.registerCommand({ id: "open-lab", label: "Open lab" }, { execute() {} });
  core.keybindings.registerKeybinding({
    action,
    keybinding: "O",
    layer: "go",
    sourceExtensionId: "pstdio.extension-lab",
    sourceExtensionLabel: "Extension Lab",
  });
  core.keyboard.open();
  expect(core.keyboard.hints().get(getNavigationTargetKey(action))).toBe("G → O");
  await core.keyboard.press("G");
  expect(core.keyboard.hints().get(getNavigationTargetKey(action))).toBe("O");
  core.commands.registerCommand({ id: "nested", label: "Nested" }, { execute() {} });
  core.keybindings.registerKeybinding({
    action: { kind: "command", commandId: "nested" },
    keybinding: ["A", "R"],
    layer: "go",
    sourceExtensionId: "pstdio.extension-lab",
    sourceExtensionLabel: "Extension Lab",
  });
  await core.keyboard.press("A");
  expect(core.keyboard.hints().get(getNavigationTargetKey(action))).toBeUndefined();
});

test("opening discovery refreshes dynamic availability", () => {
  const core = createWorkbench();
  let visible = false;
  core.commands.registerCommand({ id: "live", label: "Live" }, { execute() {}, isVisible: () => visible });
  core.keyboard.catalog();
  visible = true;
  core.keyboard.open();
  expect(core.keyboard.catalog().find((entry) => entry.id === "live")?.disabled).toBe(false);
});

test("legacy extension actions remain accessible in the shared action group without a resource", async () => {
  const core = createWorkbench();
  let calls = 0;
  core.commands.registerCommand(
    { id: "legacy", label: "Open extension tool" },
    {
      execute: () => {
        calls++;
      },
    },
  );
  core.keybindings.registerKeybinding({
    action: { kind: "command", commandId: "legacy" },
    keybinding: "O",
    layer: "extensions",
    sourceExtensionId: "acme.tool",
  });
  core.keyboard.open();
  expect(core.keyboard.catalog().find((entry) => entry.binding.sourceExtensionId === "acme.tool")?.keys).toEqual([
    "A",
    "O",
  ]);
  await core.keyboard.press("A");
  await core.keyboard.press("O");
  expect(calls).toBe(1);
});

test("shortcut hints show the configured opening chord", async () => {
  const core = createWorkbench();
  core.commands.registerCommand({ id: "go", label: "Go" }, { execute() {} });
  const action = { kind: "command" as const, commandId: "go" };
  core.keybindings.registerKeybinding({ action, keybinding: "Q", layer: "go" });
  await core.keyboard.setAssignment("workbench.keyboard.leader", { keybinding: "Alt+K" });
  core.keyboard.open();
  expect(shortcutOpeningChord(core.keyboard.catalog())).toBe("Alt+K");
  expect(core.keyboard.hints().get(getNavigationTargetKey(action))).toBe("G → Q");
  await core.keyboard.press("V");
  expect(core.keyboard.hints().get(getNavigationTargetKey(action))).toBeUndefined();
});

test("completed navigation actions exit shortcut mode and use the same destination label", async () => {
  const core = createWorkbench();
  let calls = 0;
  core.commands.registerCommand(
    { id: "tickets", label: "Open tickets" },
    {
      execute() {
        calls++;
      },
    },
  );
  const action = { kind: "command" as const, commandId: "tickets" };
  core.keybindings.registerKeybinding({ id: "go-tickets", action, keybinding: "P", layer: "go", sticky: true });
  core.keybindings.registerKeybinding({ id: "direct-tickets", action, keybinding: "Alt+T" });
  core.keyboard.open();
  expect(
    core.keyboard
      .catalog()
      .filter((entry) => entry.binding.action.kind === "command" && entry.binding.action.commandId === "tickets")
      .map((entry) => entry.label),
  ).toEqual(["Go to tickets", "Go to tickets"]);
  await core.keyboard.press("G");
  await core.keyboard.press("P");
  expect(calls).toBe(1);
  expect(core.keyboard.store.getState().active).toBe(false);
  core.keyboard.open();
  await core.keyboard.invoke("direct-tickets");
  expect(calls).toBe(2);
  expect(core.keyboard.store.getState().active).toBe(false);
});

test("completed navigation clears its sequence before shortcut mode opens again", async () => {
  const core = createWorkbench();
  core.commands.registerCommand({ id: "sessions", label: "Sessions" }, { execute() {} });
  core.keybindings.registerKeybinding({
    id: "go-sessions",
    action: { kind: "command", commandId: "sessions" },
    keybinding: "S",
    layer: "go",
  });
  core.keyboard.open();
  await core.keyboard.press("G");
  await core.keyboard.press("S");
  expect(core.keyboard.store.getState()).toMatchObject({ active: false, path: [], lastKey: undefined });
  core.keyboard.open();
  expect(core.keyboard.store.getState()).toMatchObject({ active: true, path: [], lastKey: undefined });
});
