import type { CSSProperties } from "react";
import type { GridPlacement } from "./dashboard-types";

// These values are measured placement geometry; appearance stays in the shared theme recipe.
export const placementStyle = (layout: GridPlacement) =>
  ({
    "--dashboard-x": layout.x + 1,
    "--dashboard-y": layout.y + 1,
    "--dashboard-w": layout.w,
    "--dashboard-h": layout.h,
  }) as CSSProperties;

export function measureGrid(element: HTMLDivElement, columns: number) {
  const style = getComputedStyle(element);
  const gap = Number.parseFloat(style.columnGap);
  const width = element.clientWidth - Number.parseFloat(style.paddingLeft) - Number.parseFloat(style.paddingRight);
  const scale = element.getBoundingClientRect().width / element.offsetWidth;
  return {
    column: ((width + gap) / columns) * scale,
    row: (Number.parseFloat(style.gridAutoRows) + gap) * scale,
    gap: gap * scale,
    scale,
  };
}

export function dragAnchor(element: HTMLDivElement, origin: GridPlacement, event: Event, columns: number) {
  if (!("clientX" in event && "clientY" in event)) return { x: origin.x + origin.w / 2, y: origin.y + origin.h / 2 };
  const metrics = measureGrid(element, columns);
  const bounds = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  return {
    x: (Number(event.clientX) - bounds.left - Number.parseFloat(style.paddingLeft) * metrics.scale) / metrics.column,
    y: (Number(event.clientY) - bounds.top - Number.parseFloat(style.paddingTop) * metrics.scale) / metrics.row,
  };
}

export const placementSize = (layout: Pick<GridPlacement, "w" | "h">, metrics: ReturnType<typeof measureGrid>) => ({
  width: (layout.w * metrics.column - metrics.gap) / metrics.scale,
  height: (layout.h * metrics.row - metrics.gap) / metrics.scale,
});
