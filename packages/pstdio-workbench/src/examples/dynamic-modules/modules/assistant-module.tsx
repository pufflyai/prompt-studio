import { type WorkbenchModuleContribution, workbenchCommandPaletteMenuPath } from "../../../core";
import { AssistantWidget } from "../components/assistant-widget";
import { assistantCommandId, assistantModuleId, assistantWidgetId } from "../data";

export const createAssistantModule = (): WorkbenchModuleContribution => ({
  id: assistantModuleId,
  ownerId: assistantModuleId,
  source: "extension",
  activate(ctx) {
    const openAssistant = () => {
      ctx.sessionPanel.setMode("attached");
      ctx.layout.openWidget(assistantWidgetId);
    };

    ctx.renderers.registerRenderer({ id: assistantWidgetId, render: () => <AssistantWidget /> });
    ctx.layout.registerWidget({
      id: assistantWidgetId,
      title: "Assistant",
      area: "floating",
      singleton: true,
      closable: true,
      rendererId: assistantWidgetId,
    });
    ctx.commands.registerCommand(
      { id: assistantCommandId, label: "Open assistant", category: "Dynamic modules", icon: "Bot" },
      { execute: openAssistant },
    );
    ctx.keybindings.registerKeybinding({
      commandId: assistantCommandId,
      keybinding: "mod+shift+a",
      when: "!inputFocus",
    });
    ctx.layout.registerMenuItem(workbenchCommandPaletteMenuPath, { commandId: assistantCommandId, order: 40 });
    openAssistant();
  },
});
