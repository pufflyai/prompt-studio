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
export type FloatingPanelResizeAnchor = "left" | "center" | "right";
export type FloatingPanelResizeCorner = "nw" | "ne";

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
  delta: { x: number; y: number },
  viewport: FloatingPanelViewport,
  anchor: FloatingPanelResizeAnchor = "right",
  corner: FloatingPanelResizeCorner = "nw",
) => {
  const area = panelArea(viewport);
  const right = frame.x + frame.width;
  const bottom = frame.y + frame.height;
  const minWidth = Math.min(floatingPanelGeometry.minWidth, area.width);
  const minHeight = Math.min(floatingPanelGeometry.minHeight, area.height);
  const center = frame.x + frame.width / 2;
  let maxWidth = right - area.inset;
  if (anchor === "left") maxWidth = viewport.width - area.inset - frame.x;
  if (anchor === "center") maxWidth = 2 * Math.min(center - area.inset, viewport.width - area.inset - center);
  const change = corner === "nw" ? -delta.x : delta.x;
  const width = clamp(frame.width + change * (anchor === "center" ? 2 : 1), minWidth, maxWidth);
  let x = right - width;
  if (anchor === "left") x = frame.x;
  if (anchor === "center") x = center - width / 2;
  const y = clamp(frame.y + delta.y, area.inset, bottom - minHeight);
  return fitFloatingPanel({ x, y, width, height: bottom - y }, viewport);
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
