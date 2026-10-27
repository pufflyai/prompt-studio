import type { Layout } from "../layout";
import type { Point } from "./geometry";

export interface ItemBounds {
  width: number;
  height: number;
  frame?: Point;
}
const relativePosition = (frame: HTMLElement, item: HTMLElement) => {
  let x = 0;
  let y = 0;
  for (let node: HTMLElement | null = frame; node && node !== item; node = node.offsetParent as HTMLElement | null) {
    x += node.offsetLeft;
    y += node.offsetTop;
    const parent = node.offsetParent as HTMLElement | null;
    x += parent?.clientLeft ?? 0;
    y += parent?.clientTop ?? 0;
  }
  return { x, y };
};
export const measureItem = (element: HTMLElement): ItemBounds => {
  const frame = element.querySelector<HTMLIFrameElement>("iframe[data-ui-canvas-component]");
  return {
    width: element.offsetWidth,
    height: element.offsetHeight,
    frame: frame ? relativePosition(frame, element) : undefined,
  };
};
export const frameAnchor = (layout: Layout, sizes: Map<string, ItemBounds>, id: string, point: Point) => {
  const position = layout.positions[id];
  const offset = sizes.get(id)?.frame ?? { x: 0, y: 0 };
  return {
    x: layout.camera.x + (position.x + offset.x + point.x) * layout.camera.zoom,
    y: layout.camera.y + (position.y + offset.y + point.y) * layout.camera.zoom,
  };
};
