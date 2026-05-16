import { type ShellModuleContribution, workbenchCommandPaletteMenuPath } from "../../../core";
import { AssistantWidget } from "../components/assistant-widget";
import { assistantCommandId, assistantModuleId, assistantWidgetId } from "../data";

export const createAssistantModule = (): ShellModuleContribution => ({
  id: assistantModuleId,
  ownerId: assistantModuleId,
  source: "extension",
  activate(ctx) {
    ctx.renderers.registerRenderer({ id: assistantWidgetId, render: () => <AssistantWidget /> });
    ctx.layout.registerWidget({
      id: assistantWidgetId,
      title: "Assistant",
      area: "floating",
      singleton: true,
      rendererId: assistantWidgetId,
    });
    ctx.commands.registerCommand(
      { id: assistantCommandId, label: "Open assistant", category: "Dynamic modules", icon: "Bot" },
      { execute: () => ctx.layout.openWidget(assistantWidgetId) },
    );
    ctx.menus.registerMenuAction(workbenchCommandPaletteMenuPath, { commandId: assistantCommandId, order: 40 });
    ctx.layout.openWidget(assistantWidgetId);
  },
});
