import type { Menu, MenuItemConstructorOptions } from "electron";

export const setApplicationCommandsEnabled = (menu: Menu | null, enabled: boolean) => {
  for (const item of menu?.items ?? []) {
    if (item.id?.startsWith("workbench.") || item.id?.startsWith("dashboard.")) item.enabled = enabled;
    if (item.submenu) setApplicationCommandsEnabled(item.submenu, enabled);
  }
};

export const createApplicationMenuTemplate = (
  platform: NodeJS.Platform,
  checkForUpdates: () => void,
  executeCommand: (commandId: string) => void,
) => {
  const command = (id: string, label: string, accelerator?: string) =>
    ({
      id,
      label,
      accelerator,
      enabled: false,
      click: () => executeCommand(id),
    }) satisfies MenuItemConstructorOptions;
  const standardMenus: MenuItemConstructorOptions[] = [
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "pasteAndMatchStyle" },
        { role: "delete" },
        { role: "selectAll" },
        { type: "separator" },
        command("workbench.settings.open", "Settings…", "CmdOrCtrl+,"),
        command("dashboard.openShortcuts", "Keyboard Shortcuts"),
      ],
    },
    {
      label: "View",
      submenu: [
        command("dashboard.openCommandPalette", "Search…"),
        command("dashboard.openProjects", "Open Project…"),
        command("workbench.toggleSideBar", "Toggle Sidebar"),
        command("dashboard.openNotifications", "Notifications"),
        { type: "separator" },
        command("workbench.action.navigateBack", "Back"),
        command("workbench.action.navigateForward", "Forward"),
        { type: "separator" },
        command("workbench.action.changeTheme", "Change Theme…"),
        { type: "separator" },
        { role: "reload" },
        { role: "forceReload" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    { role: "windowMenu" },
  ];
  const updateItem: MenuItemConstructorOptions = {
    label: "Check for Updates…",
    click: checkForUpdates,
  };

  if (platform === "darwin") {
    return [
      {
        label: "Prompt Studio",
        submenu: [
          { role: "about" },
          { type: "separator" },
          updateItem,
          { type: "separator" },
          { role: "services" },
          { type: "separator" },
          { role: "hide" },
          { role: "hideOthers" },
          { role: "unhide" },
          { type: "separator" },
          { role: "quit" },
        ],
      },
      ...standardMenus,
    ] satisfies MenuItemConstructorOptions[];
  }

  return [
    ...standardMenus,
    {
      label: "Help",
      submenu: [updateItem, { type: "separator" }, { role: "about" }],
    },
  ] satisfies MenuItemConstructorOptions[];
};
