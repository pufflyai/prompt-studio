import {
  WORKBENCH_KEYBOARD_OPEN_COMMAND_ID,
  WORKBENCH_KEYBOARD_SELECT_TAB_COMMAND_ID,
} from "../../registries/keybindings/keyboard-entry-commands";
import { DEFAULT_SHORTCUT_LEADER, SHORTCUT_PREFERENCE_KEY } from "../../registries/keybindings/shortcut-preferences";
import type { WorkbenchCore } from "../../workbench-core-types";
import { registerKeyboardPanelCommands } from "./keyboard-panel-commands";

export const registerKeyboardCommands = (core: WorkbenchCore) => {
  core.preferences.registerSchema({
    properties: {
      [SHORTCUT_PREFERENCE_KEY]: {
        type: "object",
        scope: "user",
        default: { overrides: {}, aliases: {} },
        description: "Personal keyboard shortcuts and pinned extension aliases.",
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
      params: { number: { type: "number", required: true } },
    },
    { execute: (args: { number: number }) => core.keyboard.selectTab(args.number) },
  );
  for (let number = 1; number <= 9; number++)
    core.keybindings.registerKeybinding({
      id: `workbench.keyboard.tab.${number}`,
      action: { kind: "command", commandId: WORKBENCH_KEYBOARD_SELECT_TAB_COMMAND_ID, args: { number } },
      keybinding: `Alt+Shift+${number}`,
      allowInInputs: true,
      sticky: true,
    });
  for (const [name, key, direction] of [
    ["Previous tab", "ArrowLeft", -1],
    ["Next tab", "ArrowRight", 1],
  ] as const) {
    const id = `workbench.keyboard.${key}`;
    core.commands.registerCommand({ id, label: name }, { execute: () => core.keyboard.nextTab(direction) });
    core.keybindings.registerKeybinding({
      id,
      action: { kind: "command", commandId: id },
      keybinding: key,
      layer: "view",
      sticky: true,
    });
  }
  registerKeyboardPanelCommands(core);
  const id = "workbench.keyboard.tabPicker";
  core.commands.registerCommand(
    { id, label: "Select tab beyond nine" },
    {
      execute: () => {
        const tabs = core.keyboard.listTabs().filter((tab) => tab.number > 9);
        if (!tabs.length) {
          core.keyboard.message("There are no tabs beyond nine.");
          return;
        }
        core.keyboard.select(
          "Select tab",
          tabs.map((tab, index) => ({
            key: String(index + 1),
            label: `${tab.number} · ${tab.label} · ${tab.region}`,
            choose: () => core.keyboard.selectPresentation(tab.id, tab.resource?.id),
          })),
        );
      },
    },
  );
  core.keybindings.registerKeybinding({
    id,
    action: { kind: "command", commandId: id },
    keybinding: "T",
    layer: "view",
    sticky: true,
  });
};
