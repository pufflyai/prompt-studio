import { floatingPanelGeometry } from "@pstdio/ui";

export interface FloatingPanelFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface FloatingPanelViewport {
  width: number;
  height: number;
}
export type FloatingPanelResizeDirection = "n" | "s" | "w" | "e" | "nw" | "ne" | "sw" | "se";

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const panelArea = (viewport: FloatingPanelViewport) => {
  const inset = Math.min(floatingPanelGeometry.inset, viewport.width / 2, viewport.height / 2);
  return { inset, width: Math.max(1, viewport.width - 2 * inset), height: Math.max(1, viewport.height - 2 * inset) };
};

export const fitFloatingPanel = (frame: FloatingPanelFrame, viewport: FloatingPanelViewport) => {
  const area = panelArea(viewport);
  const width = clamp(frame.width, Math.min(floatingPanelGeometry.minWidth, area.width), area.width);
  const height = clamp(frame.height, Math.min(floatingPanelGeometry.minHeight, area.height), area.height);
  return {
    width,
    height,
    x: clamp(frame.x, area.inset, viewport.width - area.inset - width),
    y: clamp(frame.y, area.inset, viewport.height - area.inset - height),
  };
};

export const resizeFloatingPanel = (
  frame: FloatingPanelFrame,
  direction: FloatingPanelResizeDirection,
  delta: { x: number; y: number },
  viewport: FloatingPanelViewport,
) => {
  const area = panelArea(viewport);
  const right = frame.x + frame.width;
  const bottom = frame.y + frame.height;
  const minWidth = Math.min(floatingPanelGeometry.minWidth, area.width);
  const minHeight = Math.min(floatingPanelGeometry.minHeight, area.height);
  const x = direction.includes("w") ? clamp(frame.x + delta.x, area.inset, right - minWidth) : frame.x;
  const y = direction.includes("n") ? clamp(frame.y + delta.y, area.inset, bottom - minHeight) : frame.y;
  const width = direction.includes("e")
    ? clamp(frame.width + delta.x, minWidth, viewport.width - area.inset - x)
    : right - x;
  const height = direction.includes("s")
    ? clamp(frame.height + delta.y, minHeight, viewport.height - area.inset - y)
    : bottom - y;
  return fitFloatingPanel({ x, y, width, height }, viewport);
};

export const readFloatingPanelFrame = (element: HTMLElement) => ({
  x: element.offsetLeft,
  y: element.offsetTop,
  width: element.offsetWidth,
  height: element.offsetHeight,
});

export const savedFloatingPanelFrame = (value: unknown) => {
  if (!value || typeof value !== "object") return undefined;
  const frame = value as FloatingPanelFrame;
  if (![frame.x, frame.y, frame.width, frame.height].every(Number.isFinite)) return undefined;
  return { x: frame.x, y: frame.y, width: frame.width, height: frame.height };
};
