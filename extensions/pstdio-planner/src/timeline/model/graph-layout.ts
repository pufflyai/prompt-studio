// Place the execution order on graph rows, tracks, and lanes. Rows follow the order from top to bottom:
// independent tickets next to each other in a track share a row, and a ticket always sits below its dependencies.

import type { PlanRow } from "../contracts";
import { dependencyOrder } from "./dependency-order";

export interface GraphNode {
  id: string;
  track: number;
  row: number;
  lane: number;
}

export interface GraphBand {
  deadlineId: string | null;
  startRow: number;
  rowCount: number;
  collapsed: boolean;
}

interface LayoutSection {
  deadlineId: string | null;
  collapsed?: boolean;
  rows: PlanRow[];
}

export interface LayoutOptions {
  tracks: number;
  trackOf: (row: PlanRow) => number;
  // Collapsed tracks hide their tickets, so they take no rows and no lanes.
  collapsedTracks?: ReadonlySet<number>;
}

interface Grid {
  placed: Map<string, GraphNode>;
  // Lanes taken per track and row, keyed "track:row".
  taken: Map<string, Set<number>>;
}

const cell = (track: number, row: number) => `${track}:${row}`;

const free = (grid: Grid, track: number, row: number, lane: number) => !grid.taken.get(cell(track, row))?.has(lane);

// Keep a dependency chain in one lane when its row has room; otherwise use the first free lane.
// A track has as many lanes as it needs, so a ticket never waits for room on a later row.
function laneFor(grid: Grid, track: number, row: number, preferred: number | undefined) {
  if (preferred !== undefined && free(grid, track, row, preferred)) {
    return preferred;
  }

  let lane = 0;
  while (!free(grid, track, row, lane)) {
    lane += 1;
  }

  return lane;
}

function placeTicket(grid: Grid, ticket: PlanRow, track: number, earliest: number) {
  const dependencies = ticket.dependsOn.flatMap(({ id }) => grid.placed.get(id) ?? []);
  const preferred = dependencies.find((dependency) => dependency.track === track)?.lane;
  const row = Math.max(earliest, ...dependencies.map((dependency) => dependency.row + 1));
  const lane = laneFor(grid, track, row, preferred);

  const node = { id: ticket.id, track, row, lane };
  grid.placed.set(ticket.id, node);
  grid.taken.set(cell(track, row), new Set([...(grid.taken.get(cell(track, row)) ?? []), lane]));
  return node;
}

export function layoutGraph(sections: LayoutSection[], options: LayoutOptions) {
  const grid: Grid = { placed: new Map(), taken: new Map() };
  const nodes: GraphNode[] = [];
  const bands: GraphBand[] = [];
  let nextRow = 0;
  for (const section of sections) {
    // Each deadline starts on a fresh row. Within a track, later tickets never rise above earlier ones.
    const current = new Map<number, number>();
    const shown = section.rows.filter((ticket) => !options.collapsedTracks?.has(options.trackOf(ticket)));
    for (const ticket of section.collapsed
      ? []
      : dependencyOrder(
          shown,
          ({ id }) => id,
          ({ dependsOn }) => dependsOn.map(({ id }) => id),
        )) {
      const track = options.trackOf(ticket);
      const node = placeTicket(grid, ticket, track, current.get(track) ?? nextRow);
      nodes.push(node);
      current.set(track, node.row);
    }

    const rowCount = current.size ? Math.max(...current.values()) - nextRow + 1 : 0;
    bands.push({ deadlineId: section.deadlineId, startRow: nextRow, rowCount, collapsed: Boolean(section.collapsed) });
    nextRow += rowCount;
  }

  // Each track is as wide as the lanes it uses, an empty track keeps one lane, and a collapsed track has none.
  const trackLanes = Array.from({ length: options.tracks }, (_, track) =>
    options.collapsedTracks?.has(track)
      ? 0
      : Math.max(1, ...nodes.filter((node) => node.track === track).map(({ lane }) => lane + 1)),
  );
  return { nodes, bands, trackLanes };
}
