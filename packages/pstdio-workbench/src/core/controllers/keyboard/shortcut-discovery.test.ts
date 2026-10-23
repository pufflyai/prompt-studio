import { expect, test } from "bun:test";
import { getNavigationTargetKey } from "../../registries/navigation/navigation-target-key";
import { createWorkbench } from "../../workbench-core";
import { shortcutOpeningChord } from "./shortcut-menu";

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

test("extension discovery uses its name and only advertises pressable keys", async () => {
  const core = createWorkbench();
  const action = { kind: "command" as const, commandId: "open-lab" };
  core.commands.registerCommand({ id: "open-lab", label: "Open lab" }, { execute() {} });
  core.keybindings.registerKeybinding({
    action,
    keybinding: "O",
    layer: "extensions",
    sourceExtensionId: "pstdio.extension-lab",
    sourceExtensionLabel: "Extension Lab",
  });
  core.keyboard.open();
  expect(core.keyboard.hints().get(getNavigationTargetKey(action))).toBeUndefined();
  await core.keyboard.press("E");
  const entry = core.keyboard.entries()[0]!;
  expect(entry.label).toBe("Extension Lab");
  await core.keyboard.press(entry.key);
  expect(core.keyboard.hints().get(getNavigationTargetKey(action))).toBe("O");
  core.commands.registerCommand({ id: "nested", label: "Nested" }, { execute() {} });
  core.keybindings.registerKeybinding({
    action: { kind: "command", commandId: "nested" },
    keybinding: ["A", "R"],
    layer: "extensions",
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

test("navigation aliases stay in shortcut mode and use the same destination label", async () => {
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
  await core.keyboard.invoke("direct-tickets");
  expect(calls).toBe(1);
  expect(core.keyboard.store.getState().active).toBe(true);
  core.keybindings.registerKeybinding({ id: "one-shot", action, keybinding: "Alt+O", sticky: false });
  await core.keyboard.invoke("one-shot");
  expect(core.keyboard.store.getState().active).toBe(false);
});

test("the current sequence includes a completed navigation key and keeps its continuation prefix", async () => {
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
  expect(core.keyboard.store.getState()).toMatchObject({ active: true, path: ["G"], lastKey: "S" });
  await core.keyboard.press("Backspace");
  expect(core.keyboard.store.getState().path).toEqual([]);
  expect(core.keyboard.store.getState().lastKey).toBeUndefined();
});
