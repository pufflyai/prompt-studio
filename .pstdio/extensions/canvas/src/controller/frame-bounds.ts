import type { Layout } from "../layout";
import type { Point } from "./geometry";

export interface ItemBounds {
  width: number;
  height: number;
  frame?: Point;
}
export const measureItem = (element: HTMLElement): ItemBounds => {
  const frame = element.querySelector<HTMLIFrameElement>("iframe[data-ui-canvas-component]");
  return {
    width: element.offsetWidth,
    height: element.offsetHeight,
    frame: frame ? { x: frame.offsetLeft, y: frame.offsetTop } : undefined,
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
