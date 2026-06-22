import { type WorkbenchModuleContributionContext, workbenchCommandPaletteMenuPath } from "../../../core";
import { RandomWorkbenchRail } from "../components/rail";
import { railWidgetId, randomResourceKind, randomWorkbenchModeOrder, randomWorkbenchModes } from "../mock-data/data";

const openCommandPaletteCommandId = "random.openCommandPalette";
const openCommandPaletteKeybinding = "mod+k";

const registerRandomResources = (ctx: WorkbenchModuleContributionContext) => {
  ctx.resources.registerKind({ kind: randomResourceKind, label: "Item", icon: "FileText" });
};

// Registration is module-scoped; each mode re-opens the rail in its activate,
// since resetAreas() clears all placements on mode switch.
const registerRandomWorkbenchRail = (ctx: WorkbenchModuleContributionContext) => {
  ctx.layout.registerWidget({
    id: railWidgetId,
    title: "Mode rail",
    area: "activity",
    singleton: true,
    rendererId: railWidgetId,
  });
  ctx.renderers.registerRenderer({
    id: railWidgetId,
    render: (input) => <RandomWorkbenchRail input={input} />,
  });
};

const registerRandomCommands = (ctx: WorkbenchModuleContributionContext) => {
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
  ctx.layout.registerMenuItem(workbenchCommandPaletteMenuPath, {
    commandId: openCommandPaletteCommandId,
    order: 10,
  });

  for (const [index, modeId] of randomWorkbenchModeOrder.entries()) {
    const mode = randomWorkbenchModes[modeId];
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
    ctx.layout.registerMenuItem(workbenchCommandPaletteMenuPath, {
      commandId,
      order: 100 + index,
    });
  }
};

export const registerRandomWorkbenchContributions = (ctx: WorkbenchModuleContributionContext) => {
  registerRandomResources(ctx);
  registerRandomWorkbenchRail(ctx);
  registerRandomCommands(ctx);
};
