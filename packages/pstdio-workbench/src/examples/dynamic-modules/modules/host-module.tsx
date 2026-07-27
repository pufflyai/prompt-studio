import { type WorkbenchModuleContribution, workbenchCommandPaletteMenuPath } from "../../../core";
import { DynamicModuleControls } from "../components/dynamic-module-controls";
import { ModuleInventoryWidget } from "../components/module-inventory-widget";
import type { DynamicModuleController, DynamicModuleDefinition } from "../data";
import { hostModuleId, inventoryWidgetId, openInventoryCommandId, topControlsWidgetId } from "../data";

export const createDynamicModulesHostModule = (
  controller: DynamicModuleController,
  definitions: DynamicModuleDefinition[],
): WorkbenchModuleContribution => ({
  id: hostModuleId,
  activate(ctx) {
    ctx.sidePanel.setMode("attached");
    ctx.layout.registerWidget({
      id: topControlsWidgetId,
      title: "Runtime modules",
      region: "nav",
      singleton: true,
      rendererId: topControlsWidgetId,
    });
    ctx.layout.registerWidget({
      id: inventoryWidgetId,
      title: "Module inventory",
      region: "main",
      singleton: true,
      rendererId: inventoryWidgetId,
    });
    ctx.renderers.registerRenderer({
      id: topControlsWidgetId,
      render: () => <DynamicModuleControls controller={controller} definitions={definitions} />,
    });
    ctx.renderers.registerRenderer({
      id: inventoryWidgetId,
      render: (input) => <ModuleInventoryWidget input={input} />,
    });
    ctx.commands.registerCommand(
      { id: openInventoryCommandId, label: "Open module inventory", category: "Dynamic modules", icon: "Boxes" },
      { execute: () => ctx.layout.openWidget(inventoryWidgetId) },
    );
    ctx.layout.registerMenuItem(workbenchCommandPaletteMenuPath, { commandId: openInventoryCommandId, order: 10 });
    ctx.layout.openWidget(topControlsWidgetId, { pinned: true });
    ctx.layout.openWidget(inventoryWidgetId);
  },
});
