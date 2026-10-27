import { workbenchCommandPaletteMenuPath } from "../../registries/menus/workbench-menu-paths";
import type { WorkbenchCore } from "../../workbench-core-types";
import { resolveNavigationLevels } from "./navigation-level";

export const MODE_RETURN_COMMAND_ID = "workbench.action.navigateToRootLevel";

export const modeReturnLabel = (core: WorkbenchCore) => {
  const modeId = core.modes.getActiveModeId();
  const mode = modeId ? core.modes.getMode(modeId) : undefined;
  return `Back to ${(mode?.label ?? mode?.id ?? "mode").toLocaleLowerCase()}`;
};

export const registerModeNavigationShortcuts = (core: WorkbenchCore) => {
  core.commands.registerCommand(
    {
      id: MODE_RETURN_COMMAND_ID,
      get label() {
        return modeReturnLabel(core);
      },
      category: "Navigation",
      icon: "ArrowUp",
    },
    {
      isVisible: () =>
        Boolean(core.modes.getActiveModeId()) &&
        resolveNavigationLevels({
          location: core.pages.store.getState().location,
          pages: core.pages.listPages(),
          navigationTrees: core.navigationTrees,
        }).length > 0,
      execute: () => core.pageLocations.navigateToRootLevel(),
    },
  );
  const action = { kind: "command" as const, commandId: MODE_RETURN_COMMAND_ID };
  core.keybindings.registerKeybinding({ action, keybinding: "Alt+Shift+ArrowUp", when: "!inputFocus" });
  core.layout.registerMenuItem(workbenchCommandPaletteMenuPath, {
    commandId: MODE_RETURN_COMMAND_ID,
    group: "Navigation",
  });
};
