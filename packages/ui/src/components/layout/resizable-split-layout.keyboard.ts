import type { KeyboardEvent } from "react";

interface ResizeKeyboardOptions {
  dimension: "width" | "height";
  deltaDirection: number;
  collapsed: boolean;
  collapsible: boolean;
  minSize: number;
  maxSize: number;
  getSize: () => number;
  setCollapsed: (collapsed: boolean) => void;
  commitSize: (size: number) => void;
}

export const createResizeKeyDownHandler =
  (options: ResizeKeyboardOptions) => (event: KeyboardEvent<HTMLDivElement>) => {
    const { dimension, deltaDirection, collapsed, collapsible, minSize, maxSize, getSize, setCollapsed, commitSize } =
      options;
    const negativeKey = dimension === "width" ? "ArrowLeft" : "ArrowUp";
    const positiveKey = dimension === "width" ? "ArrowRight" : "ArrowDown";
    const size = getSize();
    if (collapsed && (event.key === negativeKey || event.key === positiveKey || event.key === "End")) {
      event.preventDefault();
      setCollapsed(false);
      commitSize(size);
    } else if (event.key === negativeKey) {
      event.preventDefault();
      commitSize(size - 24 * deltaDirection);
    } else if (event.key === positiveKey) {
      event.preventDefault();
      commitSize(size + 24 * deltaDirection);
    } else if (event.key === "Home") {
      event.preventDefault();
      if (collapsible) setCollapsed(true);
      else commitSize(minSize);
    } else if (event.key === "End") {
      event.preventDefault();
      commitSize(maxSize);
    }
  };
