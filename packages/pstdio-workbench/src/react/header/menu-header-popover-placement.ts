import type { MenuHeaderPosition } from "../../core/controllers/panel-menus/menu-header-settings";

export const menuHeaderPopoverPlacement = (position: MenuHeaderPosition, align: "start" | "end" = "end") => {
  const placement = {
    left: "right-start",
    right: "left-start",
    top: align === "start" ? "bottom-start" : "bottom-end",
    bottom: align === "start" ? "top-start" : "top-end",
  } as const;
  return placement[position];
};
