import type { WorkbenchArea } from "./registries/layout/layout-model";
import { workbenchCommandPaletteMenuPath } from "./registries/menus/workbench-menu-paths";
import type { WorkbenchCore } from "./workbench-core";

const LEFT_PANEL_ID = "left";
const MAIN_BOTTOM_PANEL_ID = "main-bottom";

const setPanelOpen = (workbench: WorkbenchCore, panelId: WorkbenchArea, open: boolean) => {
  workbench.panels.setOpen(panelId, open);
  workbench.layout.setAreaVisible(panelId, open);
};

const togglePanel = (workbench: WorkbenchCore, panelId: WorkbenchArea) => {
  setPanelOpen(workbench, panelId, !workbench.panels.isOpen(panelId));
};

const builtinCommands = [
  {
    id: "workbench.toggleCommandPalette",
    label: "Toggle Command Palette",
    icon: "Command",
    keybinding: "Ctrl+Shift+P",
    execute: (workbench: WorkbenchCore) => workbench.commandPalette.toggle(),
  },
  {
    id: "workbench.action.showCommands",
    label: "Run Command",
    icon: "Terminal",
    keybinding: "Ctrl+Shift+.",
    execute: (workbench: WorkbenchCore) => workbench.commandPalette.open({ initialQuery: "> " }),
  },
  {
    id: "workbench.action.changeTheme",
    label: "Change Theme",
    icon: "Palette",
    keybinding: "Ctrl+Shift+K",
    execute: (workbench: WorkbenchCore) => workbench.commandPalette.open({ view: "theme" }),
  },
  {
    id: "workbench.action.navigateBack",
    label: "Navigate Back",
    icon: "ArrowLeft",
    keybinding: "Ctrl+Shift+[",
    execute: (workbench: WorkbenchCore) => {
      workbench.history.goBack();
    },
  },
  {
    id: "workbench.action.navigateForward",
    label: "Navigate Forward",
    icon: "ArrowRight",
    keybinding: "Ctrl+Shift+]",
    execute: (workbench: WorkbenchCore) => {
      workbench.history.goForward();
    },
  },
  {
    id: "workbench.action.navigatePrevious",
    label: "Navigate to Previous Location",
    icon: "Undo2",
    keybinding: "Ctrl+Shift+-",
    execute: (workbench: WorkbenchCore) => {
      workbench.history.goPrevious();
    },
  },
  {
    id: "workbench.action.reopenLastClosed",
    label: "Reopen Last Closed",
    icon: "RotateCcw",
    keybinding: "Ctrl+Shift+R",
    execute: (workbench: WorkbenchCore) => {
      workbench.history.reopenLastClosed();
    },
  },
  {
    id: "workbench.toggleSideBar",
    label: "Toggle Sidebar",
    icon: "PanelLeft",
    keybinding: "Ctrl+Shift+B",
    execute: (workbench: WorkbenchCore) => togglePanel(workbench, LEFT_PANEL_ID),
  },
  {
    id: "workbench.togglePanel",
    label: "Toggle Panel",
    icon: "PanelBottom",
    keybinding: "Ctrl+Shift+J",
    execute: (workbench: WorkbenchCore) => togglePanel(workbench, MAIN_BOTTOM_PANEL_ID),
  },
  {
    id: "workbench.focusMain",
    label: "Focus Main Area",
    icon: "PanelTop",
    keybinding: "Ctrl+Shift+1",
    execute: (workbench: WorkbenchCore) => workbench.focus.setActiveArea("main"),
  },
  {
    id: "workbench.focusSideBar",
    label: "Focus Sidebar",
    icon: "PanelLeft",
    keybinding: "Ctrl+Shift+2",
    execute: (workbench: WorkbenchCore) => workbench.focus.setActiveArea("sideBar"),
  },
  {
    id: "workbench.focusPanel",
    label: "Focus Panel",
    icon: "PanelBottom",
    keybinding: "Ctrl+Shift+3",
    execute: (workbench: WorkbenchCore) => workbench.focus.setActiveArea("panel"),
  },
] as const;

const closeActiveWidget = (workbench: WorkbenchCore) => {
  const activeWidgetId = workbench.layout.getLayout().activeWidgetId;
  if (!activeWidgetId) return;
  workbench.layout.closeWidget(activeWidgetId);
};

const canCloseActiveWidget = (workbench: WorkbenchCore) => {
  const activeWidgetId = workbench.layout.getLayout().activeWidgetId;
  if (!activeWidgetId) return false;
  for (const area of Object.values(workbench.layout.getLayout().areas)) {
    const placement = area.widgets.find((candidate) => candidate.widgetId === activeWidgetId);
    if (placement) return placement.closable === true;
  }
  return false;
};

interface FavoriteCurrentResourceCommandArgs {
  scope?: "user" | "project";
  projectId?: string;
  label?: string;
  icon?: string;
  description?: string;
}

interface FavoriteIdCommandArgs {
  favoriteId: string;
}

interface SavedViewCreateCommandArgs {
  name: string;
  description?: string;
  resourceKind: string;
  filter: Parameters<WorkbenchCore["savedViews"]["create"]>[0]["filter"];
  display: Parameters<WorkbenchCore["savedViews"]["create"]>[0]["display"];
  scope: "user" | "project";
  projectId?: string;
}

interface SavedViewIdCommandArgs {
  viewId: string;
}

interface SavedViewRenameCommandArgs extends SavedViewIdCommandArgs {
  name: string;
}

interface SavedViewDuplicateCommandArgs extends SavedViewIdCommandArgs {
  name?: string;
}

const resolveFavoriteScope = (workbench: WorkbenchCore, args: FavoriteCurrentResourceCommandArgs | undefined) => {
  const resourceScope = workbench.getActiveResource()?.metadata?.favoriteScope as
    | FavoriteCurrentResourceCommandArgs
    | undefined;

  return {
    scope: args?.scope ?? resourceScope?.scope ?? "user",
    projectId: args?.projectId ?? resourceScope?.projectId,
  };
};

const addCurrentResource = async (workbench: WorkbenchCore, args?: FavoriteCurrentResourceCommandArgs) => {
  const target = workbench.getActiveResource();
  if (!target) return;

  await workbench.favorites.add({
    target,
    ...resolveFavoriteScope(workbench, args),
    label: args?.label,
    icon: args?.icon,
    description: args?.description,
  });
};

const removeCurrentResource = async (workbench: WorkbenchCore, args?: FavoriteCurrentResourceCommandArgs) => {
  const target = workbench.getActiveResource();
  if (!target) return;

  const favorite = (await workbench.favorites.list(resolveFavoriteScope(workbench, args))).find(
    (candidate) => candidate.target.uri === target.uri,
  );
  if (favorite) await workbench.favorites.remove(favorite.id);
};

const clearMissingFavorites = async (workbench: WorkbenchCore, args?: FavoriteCurrentResourceCommandArgs) => {
  const favorites = await workbench.favorites.list(args?.scope ? resolveFavoriteScope(workbench, args) : undefined);
  await Promise.all(
    favorites
      .filter(
        (favorite) => favorite.target.metadata?.missing === true || !workbench.resources.getKind(favorite.target.kind),
      )
      .map((favorite) => workbench.favorites.remove(favorite.id)),
  );
};

const registerCollectionCommands = (workbench: WorkbenchCore) => {
  workbench.commands.registerCommand(
    {
      id: "favorites.toggleCurrentResource",
      label: "Toggle Current Favorite",
      category: "Favorites",
      icon: "Star",
      when: "!inputFocus",
    },
    {
      execute: (args?: FavoriteCurrentResourceCommandArgs) => {
        const target = workbench.getActiveResource();
        if (!target) return;
        return workbench.favorites.toggle({
          target,
          ...resolveFavoriteScope(workbench, args),
          label: args?.label,
          icon: args?.icon,
          description: args?.description,
        });
      },
      isEnabled: () => workbench.getActiveResource() !== undefined,
    },
  );
  workbench.commands.registerCommand(
    {
      id: "favorites.addCurrentResource",
      label: "Add Current Resource to Favorites",
      category: "Favorites",
      icon: "Star",
      when: "!inputFocus",
    },
    {
      execute: (args?: FavoriteCurrentResourceCommandArgs) => addCurrentResource(workbench, args),
      isEnabled: () => workbench.getActiveResource() !== undefined,
    },
  );
  workbench.commands.registerCommand(
    {
      id: "favorites.removeCurrentResource",
      label: "Remove Current Resource from Favorites",
      category: "Favorites",
      icon: "StarOff",
      when: "!inputFocus",
    },
    {
      execute: (args?: FavoriteCurrentResourceCommandArgs | FavoriteIdCommandArgs) => {
        if (args && "favoriteId" in args) return workbench.favorites.remove(args.favoriteId);
        return removeCurrentResource(workbench, args);
      },
      isEnabled: (args?: FavoriteCurrentResourceCommandArgs | FavoriteIdCommandArgs) =>
        Boolean(args && "favoriteId" in args) || workbench.getActiveResource() !== undefined,
    },
  );
  workbench.commands.registerCommand(
    { id: "favorites.clearMissing", label: "Clear Missing Favorites", category: "Favorites", icon: "Trash2" },
    { execute: (args?: FavoriteCurrentResourceCommandArgs) => clearMissingFavorites(workbench, args) },
  );
  workbench.commands.registerCommand(
    { id: "savedViews.create", label: "Create Saved View", category: "Saved Views", icon: "Table" },
    { execute: (args: SavedViewCreateCommandArgs) => workbench.savedViews.create(args) },
  );
  workbench.commands.registerCommand(
    { id: "savedViews.rename", label: "Rename Saved View", category: "Saved Views", icon: "Pencil" },
    { execute: (args: SavedViewRenameCommandArgs) => workbench.savedViews.update(args.viewId, { name: args.name }) },
  );
  workbench.commands.registerCommand(
    { id: "savedViews.duplicate", label: "Duplicate Saved View", category: "Saved Views", icon: "Copy" },
    { execute: (args: SavedViewDuplicateCommandArgs) => workbench.savedViews.duplicate(args.viewId, args) },
  );
  workbench.commands.registerCommand(
    { id: "savedViews.delete", label: "Delete Saved View", category: "Saved Views", icon: "Trash2" },
    { execute: (args: SavedViewIdCommandArgs) => workbench.savedViews.delete(args.viewId) },
  );

  workbench.layout.registerMenuItem(workbenchCommandPaletteMenuPath, {
    commandId: "favorites.toggleCurrentResource",
    group: "Favorites",
  });
  workbench.layout.registerMenuItem(workbenchCommandPaletteMenuPath, {
    commandId: "favorites.addCurrentResource",
    group: "Favorites",
  });
  workbench.layout.registerMenuItem(workbenchCommandPaletteMenuPath, {
    commandId: "favorites.removeCurrentResource",
    group: "Favorites",
  });
  workbench.layout.registerMenuItem(workbenchCommandPaletteMenuPath, {
    commandId: "favorites.clearMissing",
    group: "Favorites",
  });
};

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
      id: "workbench.closeActiveWidget",
      label: "Close Active Widget",
      category: "Workbench",
      icon: "X",
      when: "!inputFocus",
    },
    {
      execute: () => closeActiveWidget(workbench),
      isEnabled: () => canCloseActiveWidget(workbench),
    },
  );
  workbench.keybindings.registerKeybinding({
    commandId: "workbench.closeActiveWidget",
    keybinding: "Ctrl+Shift+X",
    when: "!inputFocus && mainFocus || !inputFocus && panelFocus",
  });
  workbench.layout.registerMenuItem(workbenchCommandPaletteMenuPath, {
    commandId: "workbench.closeActiveWidget",
    group: "Workbench",
  });

  registerCollectionCommands(workbench);
};
