import type { MenuItemConstructorOptions } from "electron";

const standardMenus: MenuItemConstructorOptions[] = [
  { role: "editMenu" },
  { role: "viewMenu" },
  { role: "windowMenu" },
];

export const createApplicationMenuTemplate = (platform: NodeJS.Platform, checkForUpdates: () => void) => {
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
