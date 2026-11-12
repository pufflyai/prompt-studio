import type { CSSProperties } from "react";
import type { GridPlacement } from "./dashboard-fixtures";

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

export const placementSize = (layout: Pick<GridPlacement, "w" | "h">, metrics: ReturnType<typeof measureGrid>) => ({
  width: (layout.w * metrics.column - metrics.gap) / metrics.scale,
  height: (layout.h * metrics.row - metrics.gap) / metrics.scale,
});
