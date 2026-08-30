import type { KeybindingSequence } from "./registries/keybindings/keybinding-registry";
import type { WorkbenchRegion } from "./registries/layout/layout-model";
import { workbenchCommandPaletteMenuPath } from "./registries/menus/workbench-menu-paths";
import type { ResourceRef } from "./registries/resources/resource-registry";
import type { WorkbenchCore } from "./workbench-core";

const SIDENAV_PANEL_ID = "sidenav";

const setPanelOpen = (workbench: WorkbenchCore, panelId: WorkbenchRegion, open: boolean) => {
  workbench.panels.setOpen(panelId, open);
  workbench.layout.setRegionVisible(panelId, open);
};

const togglePanel = (workbench: WorkbenchCore, panelId: WorkbenchRegion) => {
  setPanelOpen(workbench, panelId, !workbench.panels.isOpen(panelId));
};

interface BuiltinCommand {
  id: string;
  label: string;
  icon: string;
  keybinding: KeybindingSequence;
  execute: (workbench: WorkbenchCore) => void;
}

// Defaults use `Mod` so a single chord works on macOS (Cmd), Windows, and
// Linux (Ctrl). The command palette intentionally claims the browser print
// chord. Other built-ins must avoid the reserved table in `pstdio-extensions`.
const builtinCommands: BuiltinCommand[] = [
  {
    id: "workbench.toggleCommandPalette",
    label: "Toggle Command Palette",
    icon: "Command",
    keybinding: "Mod+P",
    execute: (workbench: WorkbenchCore) => workbench.commandPalette.toggle(),
  },
  {
    id: "workbench.action.showCommands",
    label: "Run Command",
    icon: "Terminal",
    keybinding: "Alt+Shift+K",
    execute: (workbench: WorkbenchCore) => workbench.commandPalette.open({ initialQuery: "> " }),
  },
  {
    id: "workbench.action.changeTheme",
    label: "Change Theme",
    icon: "Palette",
    keybinding: "Alt+Shift+T",
    execute: (workbench: WorkbenchCore) => workbench.commandPalette.open({ view: "theme" }),
  },
  {
    id: "workbench.action.navigateBack",
    label: "Navigate Back",
    icon: "ArrowLeft",
    keybinding: "Alt+Shift+ArrowLeft",
    execute: (workbench: WorkbenchCore) => {
      workbench.history.goBack();
    },
  },
  {
    id: "workbench.action.navigateForward",
    label: "Navigate Forward",
    icon: "ArrowRight",
    keybinding: "Alt+Shift+ArrowRight",
    execute: (workbench: WorkbenchCore) => {
      workbench.history.goForward();
    },
  },
  {
    id: "workbench.toggleSideBar",
    label: "Toggle Sidenav",
    icon: "PanelLeft",
    keybinding: "Mod+B",
    execute: (workbench: WorkbenchCore) => togglePanel(workbench, SIDENAV_PANEL_ID),
  },
];

interface WorkbenchSwitchModeCommandArgs {
  modeId: string;
}

export const workbenchSwitchModeCommandId = "workbench.action.switchMode";

// The command form of an in-page emission: renderers whose activation surface only
// speaks command targets (tree nodes) compile emissions to this built-in.
export const workbenchEmitResourceCommandId = "workbench.action.emitResource";

interface WorkbenchEmitResourceCommandArgs {
  resource: ResourceRef;
  open?: "preview" | "pin";
}

export const registerWorkbenchBuiltIns = (workbench: WorkbenchCore) => {
  for (const command of builtinCommands) {
    workbench.commands.registerCommand(
      {
        id: command.id,
        label: command.label,
        category: "Workbench",
        icon: command.icon,
        when: "!inputFocus",
      },
      { execute: () => command.execute(workbench) },
    );
    workbench.keybindings.registerKeybinding({
      commandId: command.id,
      keybinding: command.keybinding,
      when: "!inputFocus",
    });
    workbench.layout.registerMenuItem(workbenchCommandPaletteMenuPath, {
      commandId: command.id,
      group: "Workbench",
    });
  }

  workbench.commands.registerCommand(
    {
      id: workbenchSwitchModeCommandId,
      label: "Switch Mode",
      category: "Workbench",
      icon: "PanelTop",
      when: "!inputFocus",
    },
    {
      execute: async (args?: WorkbenchSwitchModeCommandArgs) => {
        if (!args?.modeId) {
          workbench.commandPalette.open({ view: "mode" });
          return;
        }
        // Extensions pass their mode's local id (they never hand-build runtime ids).
        // Resolve it against the registered modes: exact id first, then a unique
        // `<owner>.mode.<localId>` suffix match.
        const requested = args.modeId;
        const modeId = workbench.modes.getMode(requested)
          ? requested
          : (() => {
              const matches = workbench.modes
                .listModes()
                .filter((mode) => mode.id.endsWith(`.mode.${requested}`))
                .map((mode) => mode.id);
              return matches.length === 1 ? matches[0]! : requested;
            })();
        // Mode switches run through the atomic navigator so the resource, layout
        // scope, and breadcrumb commit together with the mode.
        const result = await workbench.navigator.open({ modeId });
        if (!result.ok && result.code === "navigation_mode_missing") {
          workbench.notifications.show({
            level: "error",
            title: "Mode unavailable",
            message: result.message,
          });
        }
      },
    },
  );
  workbench.layout.registerMenuItem(workbenchCommandPaletteMenuPath, {
    commandId: workbenchSwitchModeCommandId,
    group: "Workbench",
  });

  workbench.commands.registerCommand(
    { id: workbenchEmitResourceCommandId, label: "Open Resource In Page", category: "Workbench" },
    {
      execute: (args?: WorkbenchEmitResourceCommandArgs) => {
        if (!args?.resource) return undefined;
        return workbench.pages.emitResource(args.resource, { open: args.open });
      },
    },
  );
};
