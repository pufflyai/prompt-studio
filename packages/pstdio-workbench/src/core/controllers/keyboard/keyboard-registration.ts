import {
  WORKBENCH_KEYBOARD_OPEN_COMMAND_ID,
  WORKBENCH_KEYBOARD_SELECT_TAB_COMMAND_ID,
} from "../../registries/keybindings/keyboard-entry-commands";
import { DEFAULT_SHORTCUT_LEADER, SHORTCUT_PREFERENCE_KEY } from "../../registries/keybindings/shortcut-preferences";
import type { WorkbenchCore } from "../../workbench-core-types";
import { registerKeyboardPanelCommands } from "./keyboard-panel-commands";

export const registerKeyboardCommands = (core: WorkbenchCore) => {
  core.navigationTrees.onDidChange(() => core.keyboard.refresh());
  core.layout.menuStore.subscribe(() => core.keyboard.refresh());
  core.preferences.onDidChangeValue(() => core.keyboard.refresh());
  core.preferences.registerSchema({
    properties: {
      [SHORTCUT_PREFERENCE_KEY]: {
        type: "object",
        scope: "user",
        default: { overrides: {}, aliases: {} },
        description: "Personal keyboard shortcuts.",
      },
    },
  });
  core.commands.registerCommand(
    { id: WORKBENCH_KEYBOARD_OPEN_COMMAND_ID, label: "Open keyboard menu" },
    { execute: () => core.keyboard.open() },
  );
  core.keybindings.registerKeybinding({
    id: "workbench.keyboard.leader",
    action: { kind: "command", commandId: WORKBENCH_KEYBOARD_OPEN_COMMAND_ID },
    keybinding: DEFAULT_SHORTCUT_LEADER,
    allowInInputs: true,
  });
  core.commands.registerCommand(
    {
      id: WORKBENCH_KEYBOARD_SELECT_TAB_COMMAND_ID,
      label: "Select numbered tab",
      category: "Panels and tabs",
      params: { number: { type: "number", required: true } },
    },
    { execute: (args: { number: number }) => core.keyboard.selectTab(args.number) },
  );
  for (let number = 1; number <= 9; number++)
    core.keybindings.registerKeybinding({
      id: `workbench.keyboard.tab.${number}`,
      label: `Select tab ${number}`,
      action: { kind: "command", commandId: WORKBENCH_KEYBOARD_SELECT_TAB_COMMAND_ID, args: { number } },
      keybinding: `Alt+Shift+${number}`,
      allowInInputs: true,
    });
  for (const [name, key, chord, direction] of [
    ["Previous tab", "ArrowLeft", "Ctrl+Shift+Tab", -1],
    ["Next tab", "ArrowRight", "Ctrl+Tab", 1],
  ] as const) {
    const id = `workbench.keyboard.${key}`;
    core.commands.registerCommand(
      { id, label: name, category: "Panels and tabs" },
      { execute: () => core.keyboard.nextTab(direction) },
    );
    core.keybindings.registerKeybinding({
      id,
      action: { kind: "command", commandId: id },
      keybinding: chord,
      allowInInputs: true,
    });
  }
  registerKeyboardPanelCommands(core);
  const id = "workbench.keyboard.tabPicker";
  core.commands.registerCommand(
    { id, label: "Select tab beyond nine", category: "Panels and tabs" },
    {
      execute: () => {
        const tabs = core.keyboard.listNumberedTargets().filter((tab) => tab.number > 9);
        if (!tabs.length) {
          core.keyboard.message("There are no tabs beyond nine.");
          return;
        }
        core.keyboard.select(
          "Select tab",
          tabs.map((tab, index) => ({
            key: String(index + 1),
            label: `${tab.number} · ${tab.label} · ${tab.region}`,
            choose: () => core.keyboard.selectTab(tab.number),
          })),
        );
      },
    },
  );
  core.keybindings.registerKeybinding({
    id,
    action: { kind: "command", commandId: id },
    keybinding: "Alt+Shift+0",
    allowInInputs: true,
  });
};
