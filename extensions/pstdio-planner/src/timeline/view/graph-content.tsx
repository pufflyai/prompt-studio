// Compose milestone drop targets, ticket cards, and dependency edges inside the pannable graph.
import { Box } from "@chakra-ui/react";
import type { RefObject } from "react";
import type { PlanRow } from "../contracts";
import { type DropTarget, sameTarget } from "./drag";
import { DropHighlight } from "./drop-highlight";
import type { dropRegion } from "./drop-region";
import { Band } from "./graph-band";
import { GraphCard } from "./graph-card";
import { GraphEdges } from "./graph-edges";
import { type geometry, gutterWidth, visibleContentLeft } from "./graph-geometry";
import { GraphTimeline } from "./graph-timeline";
import { CollapsedColumns, TrackLines } from "./graph-tracks";
import { graphWindow, visibleGraphRows } from "./graph-window";
import type { PlanViewProps } from "./plan-view";
import { useCanvasWindow } from "./use-canvas-window";

interface GraphData {
  box: ReturnType<typeof geometry>;
  rows: PlanRow[];
  trackAt: (x: number) => string | null;
}

interface Props {
  props: PlanViewProps;
  graph: GraphData;
  visibleRows?: PlanRow[];
}

function overTarget(props: PlanViewProps, target: DropTarget) {
  if (!sameTarget(props.dropTarget, target)) {
    props.onDragTarget(target);
  }
}

function GraphMilestones(input: Pick<Props, "props" | "graph"> & { width: number; zoom: number; headerLeft: number }) {
  const { props, graph, width, zoom, headerLeft } = input;
  const { sections, dropTarget, ...actions } = props;
  const { box, trackAt } = graph;
  const over = (target: DropTarget) => overTarget(props, target);
  return (
    <>
      {box.bands.map((band) => {
        const entry = sections.find(({ section }) => (section.deadline?.id ?? null) === band.deadlineId);
        return entry ? (
          <Band
            key={band.deadlineId ?? "none"}
            band={band}
            entry={entry}
            viewWidth={width}
            contentLeft={box.contentLeft}
            zoom={zoom}
            headerLeft={headerLeft}
            dropTarget={dropTarget}
            over={over}
            trackAt={trackAt}
            onDrop={actions.onDrop}
            onToggle={actions.onToggle}
            onDelete={actions.onDelete}
            onRenameDeadline={actions.onRenameDeadline}
            onRedate={actions.onRedate}
            onReview={actions.onReview}
          />
        ) : null;
      })}
    </>
  );
}

function GraphTickets(input: Props) {
  const { props, graph, visibleRows = graph.rows } = input;
  const { relations, selectedId, dropTarget, ...actions } = props;
  const { box, rows } = graph;
  const over = (target: DropTarget) => overTarget(props, target);
  return (
    <>
      <GraphEdges
        rows={rows}
        positions={box.positions}
        width={box.width}
        height={box.height}
        selectedId={selectedId}
        relatedIds={new Set(relations.keys())}
      />
      {visibleRows.map((row) => {
        const position = box.positions.get(row.id);
        const target = { deadlineId: row.deadlineId, beforeId: row.id, trackId: row.trackId };
        return position ? (
          <GraphCard
            key={row.id}
            row={row}
            x={position.x}
            y={position.y}
            relation={relations.get(row.id)}
            dropBefore={sameTarget(dropTarget, target)}
            onSelect={actions.onSelect}
            onDragStart={actions.onDragStart}
            onDragOver={() => over(target)}
            onDrop={actions.onDrop}
          />
        ) : null;
      })}
    </>
  );
}

export function GraphContent(
  input: Props & {
    collapsed: ReadonlySet<string>;
    region: ReturnType<typeof dropRegion>;
    viewport: {
      ref: RefObject<HTMLDivElement | null>;
      width: number;
      height: number;
      canvasWidth: number;
      canvasHeight: number;
      zoom: number;
    };
  },
) {
  const { props, graph, collapsed, region, viewport } = input;
  const { sections, tracks, today, dropTarget, ...actions } = props;
  const { box, trackAt } = graph;
  const { width, height, canvasWidth, canvasHeight, zoom } = viewport;
  const window = useCanvasWindow(viewport.ref);
  const headerLeft = visibleContentLeft(box.contentLeft, window.left, zoom);
  const bounds = graphWindow({ ...window, width: width * zoom, height: height * zoom, zoom });
  const visibleRows = visibleGraphRows(
    graph.rows,
    box.positions,
    bounds,
    new Set([props.selectedId, props.dragId, window.focusedId]),
  );
  return (
    <Box
      position="relative"
      w={`${canvasWidth}px`}
      h={`${canvasHeight}px`}
      onContextMenu={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const viewportLeft =
          event.currentTarget.closest("[data-timeline-viewport]")?.getBoundingClientRect().left ?? rect.left;
        const viewportX = (event.clientX - viewportLeft) / zoom;
        if (
          viewportX < gutterWidth ||
          (event.target as HTMLElement).closest(
            "[data-ticket], [data-canvas-control], button, input, [role=menuitem], [data-part=preview]",
          )
        ) {
          return;
        }
        event.preventDefault();
        // Every track uses canvas coordinates, including collapsed columns.
        const x = (event.clientX - rect.left) / zoom;
        const band = box.bands.find(
          (entry) =>
            (event.clientY - rect.top) / zoom >= entry.top &&
            (event.clientY - rect.top) / zoom <= entry.top + entry.height,
        );
        actions.onContext({
          x: event.clientX,
          y: event.clientY,
          trackId: trackAt(x) ?? undefined,
          deadlineId: band?.deadlineId,
        });
      }}
    >
      <GraphTimeline
        bands={box.bands}
        sections={sections.map(({ section }) => section)}
        today={today}
        height={canvasHeight}
        contentLeft={box.contentLeft}
        zoom={zoom}
        dropTarget={dropTarget}
        onCreate={actions.onCreateDeadline}
      />
      <CollapsedColumns tracks={tracks.list} boxes={box.tracks} height={canvasHeight} collapsed={collapsed} />
      <TrackLines boxes={box.tracks} height={canvasHeight} contentLeft={box.contentLeft} />
      <DropHighlight region={region} width={canvasWidth} height={canvasHeight} />
      <GraphMilestones props={props} graph={graph} width={width} zoom={zoom} headerLeft={headerLeft} />
      <GraphTickets props={props} graph={graph} visibleRows={visibleRows} />
    </Box>
  );
}
