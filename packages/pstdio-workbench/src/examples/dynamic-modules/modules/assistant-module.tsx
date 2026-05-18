import { type WorkbenchModuleContribution, type WorkbenchTheme, workbenchCommandPaletteMenuPath } from "../../../core";
import { AssistantWidget } from "../components/assistant-widget";
import { assistantCommandId, assistantModuleId, assistantThemeId, assistantWidgetId } from "../data";

const assistantTheme = {
  id: assistantThemeId,
  tokens: {
    activityBarBackground: "color-mix(in srgb, var(--chakra-colors-bg-muted) 76%, #2563eb 24%)",
    sideBarBackground: "color-mix(in srgb, var(--chakra-colors-bg-subtle) 76%, #16a34a 24%)",
    mainBackground: "color-mix(in srgb, var(--chakra-colors-bg) 82%, #7c3aed 18%)",
    panelBackground: "color-mix(in srgb, var(--chakra-colors-bg-panel) 78%, #f59e0b 22%)",
    statusBarBackground: "color-mix(in srgb, var(--chakra-colors-bg-muted) 74%, #0891b2 26%)",
    focusBorder: "#facc15",
    commandPaletteBackground: "color-mix(in srgb, var(--chakra-colors-bg-panel) 78%, #7c3aed 22%)",
  },
} satisfies WorkbenchTheme;

export const createAssistantModule = (): WorkbenchModuleContribution => ({
  id: assistantModuleId,
  ownerId: assistantModuleId,
  source: "extension",
  activate(ctx) {
    const openAssistant = () => {
      ctx.sessionPanel.setMode("attached");
      ctx.layout.openWidget(assistantWidgetId);
    };

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
