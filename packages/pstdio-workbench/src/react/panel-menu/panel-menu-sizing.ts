interface CanAttachWorkbenchPanelMenuInput {
  panelWidth: number;
  targetMenuMinSize: number;
  attachedMenuMinSizes: readonly number[];
}

export const PANEL_CONTENT_MIN_SIZE_PX = 120;
export const PANEL_MENU_RESIZE_HANDLE_SIZE_PX = 4;
export const PANEL_MENU_COLLAPSE_THRESHOLD_PX = 480;

export const shouldCollapseWorkbenchPanelMenus = (panelWidth: number) =>
  panelWidth > 0 && panelWidth <= PANEL_MENU_COLLAPSE_THRESHOLD_PX;

export const canAttachWorkbenchPanelMenu = (input: CanAttachWorkbenchPanelMenuInput) => {
  const menuMinSizes = [...input.attachedMenuMinSizes, input.targetMenuMinSize];
  const requiredWidth =
    PANEL_CONTENT_MIN_SIZE_PX +
    menuMinSizes.reduce((total, size) => total + size, 0) +
    menuMinSizes.length * PANEL_MENU_RESIZE_HANDLE_SIZE_PX;

  return input.panelWidth >= requiredWidth;
};
