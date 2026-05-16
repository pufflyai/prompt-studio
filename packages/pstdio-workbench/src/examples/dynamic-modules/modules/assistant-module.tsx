import { type WorkbenchModuleContribution, type WorkbenchTheme, workbenchCommandPaletteMenuPath } from "../../../core";
import { AssistantWidget } from "../components/assistant-widget";
import { assistantCommandId, assistantModuleId, assistantThemeId, assistantWidgetId } from "../data";

const assistantTheme = {
  id: assistantThemeId,
  tokens: {
    activityBarBackground: "#172033",
    sideBarBackground: "#13251f",
    mainBackground: "#1c1a24",
    panelBackground: "#211f18",
    statusBarBackground: "#083344",
    focusBorder: "#facc15",
    commandPaletteBackground: "#18181b",
  },
} satisfies WorkbenchTheme;

export const createAssistantModule = (): WorkbenchModuleContribution => ({
  id: assistantModuleId,
  ownerId: assistantModuleId,
  source: "extension",
  activate(ctx) {
    ctx.theme.registerTheme(assistantTheme);
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
      { execute: () => ctx.layout.openWidget(assistantWidgetId) },
    );
    ctx.keybindings.registerKeybinding({
      commandId: assistantCommandId,
      keybinding: "mod+shift+a",
      when: "!inputFocus",
    });
    ctx.menus.registerMenuAction(workbenchCommandPaletteMenuPath, { commandId: assistantCommandId, order: 40 });
  },
});
