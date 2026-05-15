import { type ShellCore, workbenchCommandPaletteMenuPath } from "../../../core";
import { RandomShellRail } from "../components/rail";
import { railWidgetId, randomResourceKind, randomShellModeOrder, randomShellModes } from "../mock-data/data";

const openCommandPaletteCommandId = "random.openCommandPalette";
const openCommandPaletteKeybinding = "Meta+P";

const registerRandomResources = (shell: ShellCore) => {
  shell.resources.registerKind({ kind: randomResourceKind, label: "Item", icon: "FileText" });
};

const registerRandomShellRail = (shell: ShellCore) => {
  shell.layout.registerWidget({
    id: railWidgetId,
    title: "Mode rail",
    area: "activityBar",
    singleton: true,
    renderer: "react",
    rendererId: railWidgetId,
  });
  shell.renderers.registerRenderer({
    id: railWidgetId,
    render: (input) => <RandomShellRail input={input} />,
  });
  shell.layout.openWidget(railWidgetId, { pinned: true, closable: false });
};

const registerRandomCommands = (shell: ShellCore) => {
  shell.commands.registerCommand(
    {
      id: openCommandPaletteCommandId,
      label: "Show command palette",
      category: "Workbench",
      icon: "Search",
    },
    { execute: () => shell.commandPalette.open() },
  );
  shell.keybindings.registerKeybinding({
    commandId: openCommandPaletteCommandId,
    keybinding: openCommandPaletteKeybinding,
  });
  shell.menus.registerMenuAction(workbenchCommandPaletteMenuPath, {
    commandId: openCommandPaletteCommandId,
    order: 10,
  });

  for (const [index, modeId] of randomShellModeOrder.entries()) {
    const mode = randomShellModes[modeId];
    const commandId = `random.activateMode.${mode.id}`;
    shell.commands.registerCommand(
      {
        id: commandId,
        label: `Switch to ${mode.label}`,
        category: "Modes",
        icon: mode.topIcon,
      },
      { execute: () => shell.modes.setActiveMode(mode.id) },
    );
    shell.menus.registerMenuAction(workbenchCommandPaletteMenuPath, {
      commandId,
      order: 100 + index,
    });
  }
};

export const activateRandomShellModule = (shell: ShellCore) => {
  registerRandomResources(shell);
  registerRandomShellRail(shell);
  registerRandomCommands(shell);
};
