import type { PanelMenuDetails } from "../../core";

const DEFAULT_MENU_SIZE_PX = 110;
export const PANEL_MENU_CONTENT_MIN_SIZE_PX = 320;

interface ResolveResponsivePanelMenusInput {
  left?: PanelMenuDetails;
  right?: PanelMenuDetails;
  widthPx: number;
}

const menuSize = (menu: PanelMenuDetails | undefined) => (menu ? (menu.binding.sizePx ?? DEFAULT_MENU_SIZE_PX) : 0);

export const resolveResponsivePanelMenus = (input: ResolveResponsivePanelMenusInput) => {
  const { left, right, widthPx } = input;
  const attached = [left, right].filter((menu): menu is PanelMenuDetails => Boolean(menu));
  const requiredWidth = PANEL_MENU_CONTENT_MIN_SIZE_PX + menuSize(left) + menuSize(right);
  const collapsed = widthPx > 0 && widthPx < requiredWidth ? attached : [];

  return {
    docked: {
      left: collapsed.length > 0 ? undefined : left,
      right: collapsed.length > 0 ? undefined : right,
    },
    collapsed,
  };
};
