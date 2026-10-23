import { expect, test } from "bun:test";
import { getNavigationTargetKey } from "../../registries/navigation/navigation-target-key";
import { createWorkbench } from "../../workbench-core";

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
  await core.keyboard.press("V");
  expect(core.keyboard.hints().get(getNavigationTargetKey(action))).toBe("Alt+K → G → Q");
});
