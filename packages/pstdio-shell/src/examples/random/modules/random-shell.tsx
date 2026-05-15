import { type ShellModuleContributionContext, workbenchCommandPaletteMenuPath } from "../../../core";
import { RandomShellRail } from "../components/rail";
import { railWidgetId, randomResourceKind, randomShellModeOrder, randomShellModes } from "../mock-data/data";

const openCommandPaletteCommandId = "random.openCommandPalette";
const openCommandPaletteKeybinding = "Meta+P";

const registerRandomResources = (ctx: ShellModuleContributionContext) => {
  ctx.resources.registerKind({ kind: randomResourceKind, label: "Item", icon: "FileText" });
};

const registerRandomShellRail = (ctx: ShellModuleContributionContext) => {
  ctx.layout.registerWidget({
    id: railWidgetId,
    title: "Mode rail",
    area: "activityBar",
    singleton: true,
    rendererId: railWidgetId,
  });
  ctx.renderers.registerRenderer({
    id: railWidgetId,
    render: (input) => <RandomShellRail input={input} />,
  });
  ctx.layout.openWidget(railWidgetId, { pinned: true });
};

const registerRandomCommands = (ctx: ShellModuleContributionContext) => {
  ctx.commands.registerCommand(
    {
      id: openCommandPaletteCommandId,
      label: "Show command palette",
      category: "Workbench",
      icon: "Search",
    },
    { execute: () => ctx.commandPalette.open() },
  );
  ctx.keybindings.registerKeybinding({
    commandId: openCommandPaletteCommandId,
    keybinding: openCommandPaletteKeybinding,
  });
  ctx.menus.registerMenuAction(workbenchCommandPaletteMenuPath, {
    commandId: openCommandPaletteCommandId,
    order: 10,
  });

  for (const [index, modeId] of randomShellModeOrder.entries()) {
    const mode = randomShellModes[modeId];
    const commandId = `random.activateMode.${mode.id}`;
    ctx.commands.registerCommand(
      {
        id: commandId,
        label: `Switch to ${mode.label}`,
        category: "Modes",
        icon: mode.topIcon,
      },
      { execute: () => ctx.modes.setActiveMode(mode.id) },
    );
    ctx.menus.registerMenuAction(workbenchCommandPaletteMenuPath, {
      commandId,
      order: 100 + index,
    });
  }
};

export const registerRandomShellContributions = (ctx: ShellModuleContributionContext) => {
  registerRandomResources(ctx);
  registerRandomShellRail(ctx);
  registerRandomCommands(ctx);
};
