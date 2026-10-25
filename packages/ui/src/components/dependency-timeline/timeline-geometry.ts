import { dependencyTimelineMetrics as metrics } from "../../theme/primitives/dependency-timeline";
import type { TimelineTrack } from "./dependency-timeline.types";
// Turn graph rows, tracks, and lanes into pixel positions for cards, milestone bands, tracks, edges, and the timeline gutter.
import type { GraphBand, GraphNode } from "./timeline-layout";

export const card = { width: metrics.cardWidth, height: metrics.cardHeight };

const laneGap = metrics.laneGap;

// Tracks sit further apart than lanes so the line between them has room.
export const trackGap = metrics.trackGap;

const rowGap = metrics.rowGap;

export const headerHeight = metrics.headerHeight;

const emptyHeight = metrics.emptyHeight;

const bandGap = metrics.bandGap;

export const padding = metrics.padding;

export const trackHeaderHeight = metrics.trackHeaderHeight;

// Room after the last track for the new-track button.
export const newTrackWidth = metrics.newTrackWidth;

// The timeline gutter on the left holds milestone dates and the line that joins their headers.
export const gutterWidth = metrics.gutterWidth;

// The x position of the timeline line inside the gutter.
export const lineX = metrics.lineX;

// A collapsed track keeps a narrow column for its toggle and vertical name.
export const collapsedTrackWidth = metrics.collapsedTrackWidth;

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

export const trackAt = (boxes: TrackBox[], tracks: TimelineTrack[], x: number) => {
  if (x < gutterWidth) return undefined;
  let nearest = -1;
  let distance = Number.POSITIVE_INFINITY;
  for (const [index, box] of boxes.entries()) {
    const nextDistance = Math.max(box.x - x, x - box.x - box.width, 0);
    if (nextDistance < distance) {
      nearest = index;
      distance = nextDistance;
    }
  }
  return tracks[nearest]?.id;
};

// A track with no lanes is collapsed.
function trackBoxes(trackLanes: number[]) {
  const contentLeft = gutterWidth + trackLanes.filter((lanes) => lanes === 0).length * collapsedTrackWidth;
  let closedX = gutterWidth;
  let openX = contentLeft + padding;
  const tracks = trackLanes.map((lanes) => {
    if (lanes === 0) {
      const box = { x: closedX, width: collapsedTrackWidth };
      closedX += collapsedTrackWidth;
      return box;
    }

    const box = { x: openX, width: lanes * (card.width + laneGap) - laneGap };
    openX += box.width + laneGap + trackGap;
    return box;
  });
  return { tracks, contentLeft };
}

function bandBoxes(bands: GraphBand[], rowOffsets: number[]) {
  let y = padding;
  const boxes: BandBox[] = bands.map((band) => {
    const body = band.collapsed
      ? 0
      : Math.max(rowOffsets[band.startRow + band.rowCount] - rowOffsets[band.startRow], emptyHeight);
    const box = { ...band, top: y, bodyTop: y + headerHeight, height: headerHeight + body };
    y += box.height + bandGap;
    return box;
  });
  return { boxes, height: y };
}

export function geometry(
  layout: { bands: GraphBand[]; nodes: GraphNode[]; trackLanes: number[] },
  cardHeights: ReadonlyMap<string, number> = new Map(),
) {
  const { tracks, contentLeft } = trackBoxes(layout.trackLanes);
  // Item contents keep their full titles; each graph row takes its tallest card.
  const rowHeights = Array.from(
    { length: Math.max(0, ...layout.bands.map((band) => band.startRow + band.rowCount)) },
    () => card.height,
  );
  for (const node of layout.nodes) {
    rowHeights[node.row] = Math.max(rowHeights[node.row], cardHeights.get(node.id) ?? card.height);
  }
  const rowOffsets = [0];
  for (const height of rowHeights) rowOffsets.push(rowOffsets.at(-1)! + height + rowGap);
  const { boxes, height } = bandBoxes(layout.bands, rowOffsets);
  const bandFor = (row: number) =>
    boxes.find((box) => row >= box.startRow && row < box.startRow + box.rowCount) ?? boxes[0];
  const positions = new Map(
    layout.nodes.map((node) => {
      const band = bandFor(node.row);
      return [
        node.id,
        {
          x: tracks[node.track].x + node.lane * (card.width + laneGap),
          y: band.bodyTop + rowOffsets[node.row] - rowOffsets[band.startRow] + metrics.cardInset,
          width: card.width,
          height: cardHeights.get(node.id) ?? card.height,
        },
      ];
    }),
  );
  const width = Math.max(contentLeft, ...tracks.map((track) => track.x + track.width)) + padding;
  return { bands: boxes, tracks, positions, contentLeft, width, height };
}
