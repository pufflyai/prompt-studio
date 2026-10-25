import type { NodeBox } from "./edge-path";
import { card, trackHeaderHeight } from "./timeline-geometry";

interface CanvasViewport {
  left: number;
  top: number;
  width: number;
  height: number;
  zoom: number;
}

// Keep a card's width of overscan so panning does not expose an empty strip.
export const graphWindow = ({ left, top, width, height, zoom }: CanvasViewport) => ({
  x: left / zoom - card.width,
  y: top / zoom - trackHeaderHeight - card.width,
  width: width / zoom + card.width * 2,
  height: height / zoom + card.width * 2,
});

export const intersectsWindow = (box: NodeBox, window: NodeBox) =>
  box.x <= window.x + window.width &&
  box.x + box.width >= window.x &&
  box.y <= window.y + window.height &&
  box.y + box.height >= window.y;

export const edgeIntersectsWindow = (from: NodeBox, to: NodeBox, window: NodeBox) =>
  intersectsWindow(
    {
      x: Math.min(from.x, to.x),
      y: Math.min(from.y, to.y),
      width: Math.max(from.x + from.width, to.x + to.width) - Math.min(from.x, to.x),
      height: Math.max(from.y + from.height, to.y + to.height) - Math.min(from.y, to.y),
    },
    window,
  );

export const visibleGraphRows = <T extends { id: string }>(
  rows: T[],
  positions: Map<string, NodeBox>,
  window: NodeBox,
  retained: ReadonlySet<string | undefined>,
) => rows.filter(({ id }) => retained.has(id) || (positions.has(id) && intersectsWindow(positions.get(id)!, window)));
