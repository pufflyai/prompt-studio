import type { ShellModuleContribution } from "pstdio-shell/core";
import { workbenchCommandPaletteMenuPath } from "pstdio-shell/core";
import { createElement } from "react";
import {
  SETTINGS_ICON,
  SETTINGS_MODULE_ID,
  SETTINGS_NAVIGATION_PARSER_ID,
  SETTINGS_NAVIGATOR_ID,
  SETTINGS_OPEN_COMMAND_ID,
  SETTINGS_OPEN_KEYBINDING,
  SETTINGS_RESOURCE_KIND,
  SETTINGS_WIDGET_ID,
} from "./constants";
import { createSettingsHref, createSettingsResource, isSettingsResource, parseSettingsLocation } from "./resources";
import { SettingsWidget } from "./widgets/settings-widget";

export * from "./constants";
export * from "./resources";

const navigateToHref = (href: string) => {
  if (typeof window !== "undefined" && href) window.location.hash = href.slice(1);
  return href;
};

export const createSettingsModule = (): ShellModuleContribution => ({
  id: SETTINGS_MODULE_ID,
  activate(ctx) {
    ctx.resources.registerKind({ kind: SETTINGS_RESOURCE_KIND, label: "Settings", icon: SETTINGS_ICON });

    ctx.navigation.registerParser({
      id: SETTINGS_NAVIGATION_PARSER_ID,
      priority: 100,
      canParse: (location) => parseSettingsLocation(location) !== null,
      parse: (location) => parseSettingsLocation(location)!,
    });

    ctx.navigation.registerNavigator({
      id: SETTINGS_NAVIGATOR_ID,
      priority: 100,
      canNavigate: isSettingsResource,
      createHref: () => createSettingsHref(),
      navigate: () => navigateToHref(createSettingsHref()),
    });

    ctx.layout.registerWidget({
      id: SETTINGS_WIDGET_ID,
      title: "Settings",
      area: "main",
      singleton: true,
      resourceKinds: [SETTINGS_RESOURCE_KIND],
      rendererId: SETTINGS_WIDGET_ID,
    });

    ctx.renderers.registerRenderer({
      id: SETTINGS_WIDGET_ID,
      render: (input) => createElement(SettingsWidget, { input }),
    });

    ctx.resources.registerOpener({
      id: SETTINGS_WIDGET_ID,
      priority: 100,
      canOpen: isSettingsResource,
      open: (resource, input) =>
        ctx.layout.openWidget(SETTINGS_WIDGET_ID, { resource, replaceActive: input.replaceActive }),
    });

    ctx.commands.registerCommand(
      {
        id: SETTINGS_OPEN_COMMAND_ID,
        label: "Open settings",
        category: "Workbench",
        icon: SETTINGS_ICON,
      },
      { execute: () => ctx.resources.openResource(createSettingsResource()) },
    );

    ctx.keybindings.registerKeybinding({
      commandId: SETTINGS_OPEN_COMMAND_ID,
      keybinding: SETTINGS_OPEN_KEYBINDING,
    });

    ctx.menus.registerMenuAction(workbenchCommandPaletteMenuPath, {
      commandId: SETTINGS_OPEN_COMMAND_ID,
      order: 30,
    });
  },
});
