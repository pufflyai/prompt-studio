import type { ShellModuleContribution } from "pstdio-shell/core";
import { workbenchCommandPaletteMenuPath } from "pstdio-shell/core";
import {
  COMMAND_PALETTE_ICON,
  COMMAND_PALETTE_MODULE_ID,
  COMMAND_PALETTE_OPEN_COMMAND_ID,
  COMMAND_PALETTE_OPEN_KEYBINDING,
} from "./constants";
import { matchesKeybinding } from "./keybinding-matcher";

export * from "./constants";

export const createCommandPaletteModule = (): ShellModuleContribution => ({
  id: COMMAND_PALETTE_MODULE_ID,
  activate(ctx) {
    ctx.commands.registerCommand(
      {
        id: COMMAND_PALETTE_OPEN_COMMAND_ID,
        label: "Show command palette",
        category: "Workbench",
        icon: COMMAND_PALETTE_ICON,
      },
      { execute: () => ctx.commandPalette.open() },
    );

    ctx.keybindings.registerKeybinding({
      commandId: COMMAND_PALETTE_OPEN_COMMAND_ID,
      keybinding: COMMAND_PALETTE_OPEN_KEYBINDING,
    });

    ctx.menus.registerMenuAction(workbenchCommandPaletteMenuPath, {
      commandId: COMMAND_PALETTE_OPEN_COMMAND_ID,
      order: 0,
    });

    if (typeof window === "undefined") return;

    const handleKeydown = (event: KeyboardEvent) => {
      const match = ctx.keybindings
        .listActiveKeybindings()
        .find((keybinding) => matchesKeybinding(keybinding.keybinding, event));
      if (!match) return;

      event.preventDefault();
      void ctx.commands.executeCommand(match.commandId, match.args).catch(() => undefined);
    };

    window.addEventListener("keydown", handleKeydown);
    return {
      dispose: () => window.removeEventListener("keydown", handleKeydown),
    };
  },
});
