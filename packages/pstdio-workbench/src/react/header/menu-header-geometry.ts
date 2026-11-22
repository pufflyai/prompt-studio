import type { Header } from "@pstdio/ui";
import type { ComponentProps } from "react";
import type { MenuHeaderPosition } from "../../core/controllers/panel-menus/menu-header-settings";
export const menuHeaderGeometry = (position: MenuHeaderPosition): Partial<ComponentProps<typeof Header>> => {
  const horizontal = position === "top" || position === "bottom";
  const dimensions = horizontal ? { w: "full" } : { w: "8", h: "full", py: "2xs", px: "0" };
  return {
    position: "relative",
    ...dimensions,
    borderBottomWidth: position === "top" ? "1px" : "0",
    borderTopWidth: position === "bottom" ? "1px" : "0",
    borderRightWidth: position === "left" ? "1px" : "0",
    borderLeftWidth: position === "right" ? "1px" : "0",
  };
};
