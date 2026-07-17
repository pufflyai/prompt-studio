import { useEffect, useState } from "react";
import { resolveResponsivePanelMenus } from "./responsive-panel-menus";
import type { PanelMenusResult } from "./use-panel-menus";

export const useElementWidth = () => {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (!element) return;

    const updateWidth = () => setWidth(element.getBoundingClientRect().width);
    updateWidth();
    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);

  return { setElement, width };
};

export const resolveResponsivePanelMenuState = (menus: PanelMenusResult, widthPx: number) => {
  const responsive = resolveResponsivePanelMenus({ ...menus.docked, widthPx });
  const toggleKeys = new Set([...menus.toggles, ...responsive.collapsed].map((menu) => menu.key));

  return {
    ...menus,
    docked: responsive.docked,
    toggles: menus.menus.filter((menu) => toggleKeys.has(menu.key)),
    dockable: menus.dockable && responsive.collapsed.length === 0,
  };
};

export const useResponsivePanelMenus = (menus: PanelMenusResult, widthPx: number) =>
  resolveResponsivePanelMenuState(menus, widthPx);
