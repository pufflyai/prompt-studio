import type { ShellModuleContribution } from "pstdio-shell/core";
import { createElement } from "react";
import { MODE_SWITCHER_WIDGET_ID, MODES_MODULE_ID, modeOrder, SESSIONS_BROWSER_MODE_ID } from "./constants";
import { ModeSwitcher } from "./mode-switcher";
import { createSessionsBrowserMode } from "./sessions-browser-mode";
import { createZenMode } from "./zen-mode";

export const createModesModule = (): ShellModuleContribution => ({
  id: MODES_MODULE_ID,
  activate(ctx) {
    ctx.layout.registerWidget({
      id: MODE_SWITCHER_WIDGET_ID,
      title: "Mode switcher",
      area: "activityBar",
      singleton: true,
      rendererId: MODE_SWITCHER_WIDGET_ID,
    });

    ctx.renderers.registerRenderer({
      id: MODE_SWITCHER_WIDGET_ID,
      render: (input) => createElement(ModeSwitcher, { input }),
    });

    ctx.modes.registerMode(createSessionsBrowserMode());
    ctx.modes.registerMode(createZenMode());

    for (const mode of modeOrder) {
      ctx.commands.registerCommand(
        {
          id: `modes.switchTo.${mode.id}`,
          label: `Switch mode: ${mode.label}`,
          category: "Modes",
          icon: mode.icon,
        },
        { execute: () => ctx.modes.setActiveMode(mode.id) },
      );
    }

    ctx.modes.setActiveMode(SESSIONS_BROWSER_MODE_ID);
  },
});
