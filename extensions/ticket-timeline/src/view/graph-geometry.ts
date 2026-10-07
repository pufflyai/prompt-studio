// Turn graph rows, tracks, and lanes into pixel positions for cards, milestone bands, tracks, edges, and the timeline gutter.
import type { PlanRow } from "../contracts";
import type { GraphBand, GraphNode } from "../model/graph-layout";

export const card = { width: 240, height: 68 };

const artifactCard = { width: 360, height: 300 };

export interface NodeSize {
  width: number;
  height: number;
}

const laneGap = 32;

// Tracks sit further apart than lanes so the line between them has room.
export const trackGap = 24;

export const nodeSize = (row: Pick<PlanRow, "artifact">): NodeSize => (row.artifact ? artifactCard : card);

const rowGap = 40;

export const headerHeight = 42;

const emptyHeight = 56;

const bandGap = 16;

export const padding = 16;

export const trackHeaderHeight = 32;

// Room after the last track for the new-track button.
export const newTrackWidth = 120;

// The timeline gutter on the left holds milestone dates and the line that joins their headers.
export const gutterWidth = 72;

// The x position of the timeline line inside the gutter.
export const lineX = 58;

// A collapsed track keeps a narrow column for its toggle and vertical name.
export const collapsedTrackWidth = 36;

// Only the date gutter keeps space once the collapsed columns have moved out of view.
export const visibleContentLeft = (contentLeft: number, scrollLeft: number, zoom: number) =>
  Math.max(gutterWidth, contentLeft - scrollLeft / zoom);

export interface BandBox extends GraphBand {
  top: number;
  bodyTop: number;
  height: number;
}

export interface TrackBox {
  x: number;
  width: number;
}

// A track with no lanes is collapsed.
function trackBoxes(trackLanes: number[], laneWidths: number[]) {
  const contentLeft = gutterWidth + trackLanes.filter((lanes) => lanes === 0).length * collapsedTrackWidth;
  let closedX = gutterWidth;
  let openX = contentLeft + padding;
  const tracks = trackLanes.map((lanes, index) => {
    if (lanes === 0) {
      const box = { x: closedX, width: collapsedTrackWidth };
      closedX += collapsedTrackWidth;
      return box;
    }

    const box = { x: openX, width: lanes * laneWidths[index] - laneGap };
    openX += box.width + laneGap + trackGap;
    return box;
  });
  return { tracks, contentLeft };
}

// Count row height once for both band boundaries and node positions.
function rowSpan(heights: Map<number, number>, start: number, count: number) {
  let total = 0;
  for (let row = start; row < start + count; row++) {
    total += (heights.get(row) ?? card.height) + rowGap;
  }
  return total;
}

function bandBoxes(bands: GraphBand[], rowHeights: Map<number, number>) {
  let y = padding;
  const boxes: BandBox[] = bands.map((band) => {
    const body = band.collapsed ? 0 : Math.max(rowSpan(rowHeights, band.startRow, band.rowCount), emptyHeight);
    const box = { ...band, top: y, bodyTop: y + headerHeight, height: headerHeight + body };
    y += box.height + bandGap;
    return box;
  });
  return { boxes, height: y };
}

export function geometry(
  layout: { bands: GraphBand[]; nodes: GraphNode[]; trackLanes: number[] },
  nodeSizes: ReadonlyMap<string, NodeSize> = new Map(),
) {
  // Every lane in a track leaves room for its widest visible card.
  const laneWidths = layout.trackLanes.map(() => card.width + laneGap);
  const rowHeights = new Map<number, number>();
  for (const node of layout.nodes) {
    const size = nodeSizes.get(node.id) ?? card;
    laneWidths[node.track] = Math.max(laneWidths[node.track], size.width + laneGap);
    rowHeights.set(node.row, Math.max(rowHeights.get(node.row) ?? card.height, size.height));
  }
  const { tracks, contentLeft } = trackBoxes(layout.trackLanes, laneWidths);
  const { boxes, height } = bandBoxes(layout.bands, rowHeights);
  const bandFor = (row: number) =>
    boxes.find((box) => row >= box.startRow && row < box.startRow + box.rowCount) ?? boxes[0];
  const positions = new Map(
    layout.nodes.map((node) => {
      const band = bandFor(node.row);
      return [
        node.id,
        {
          x: tracks[node.track].x + node.lane * laneWidths[node.track],
          y: band.bodyTop + rowSpan(rowHeights, band.startRow, node.row - band.startRow) + 20,
          ...(nodeSizes.get(node.id) ?? card),
        },
      ];
    }),
  );
  const width = Math.max(contentLeft, ...tracks.map((track) => track.x + track.width)) + padding;
  return { bands: boxes, tracks, positions, contentLeft, width, height };
}
