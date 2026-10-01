interface WorkbenchPanelMenuSize {
  has: boolean;
  open: boolean;
  collapsible: boolean;
  minSize: number;
}

export const PANEL_CONTENT_MIN_SIZE_PX = 120;
export const PANEL_MENU_RESIZE_HANDLE_SIZE_PX = 1;
// Narrow panels give their full width to content, even when a menu's minimum width would fit.
export const PANEL_MENU_NARROW_PANEL_MAX_PX = 480;

export const getWorkbenchPanelMenuAttachment = (panelWidth: number, menus: readonly WorkbenchPanelMenuSize[]) => {
  if (panelWidth === 0) return menus.map((menu) => menu.has && (menu.open || !menu.collapsible));

  const attached = new Set(menus.filter((menu) => menu.has && !menu.collapsible));
  const narrow = panelWidth <= PANEL_MENU_NARROW_PANEL_MAX_PX;
  const fits = (menu: WorkbenchPanelMenuSize) => {
    const sizes = [...attached, menu];
    return (
      !narrow &&
      panelWidth >=
        PANEL_CONTENT_MIN_SIZE_PX +
          sizes.reduce((total, candidate) => total + candidate.minSize + PANEL_MENU_RESIZE_HANDLE_SIZE_PX, 0)
    );
  };

  // Keep content usable and reserve fixed menus before optional menus, in side order.
  for (const menu of menus) {
    if (menu.has && menu.open && !attached.has(menu) && fits(menu)) attached.add(menu);
  }
  return menus.map((menu) => menu.has && (attached.has(menu) || fits(menu)));
};
