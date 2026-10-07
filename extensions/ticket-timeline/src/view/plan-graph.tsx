// Show the plan as a dependency graph: the milestone timeline runs down the left, execution order runs down,
// parallel work sits side by side, each milestone is a band, and collapsible tracks split every band into columns.
import { Box } from "@chakra-ui/react";
import { useMemo, useState } from "react";
import { layoutGraph } from "../model/graph-layout";
import { dropRegion } from "./drop-region";
import { GraphContent } from "./graph-content";
import { geometry, newTrackWidth, nodeSize, trackHeaderHeight, visibleContentLeft } from "./graph-geometry";
import { TrackHeader } from "./graph-tracks";
import type { PlanViewProps } from "./plan-view";
import { useCanvasPan } from "./use-canvas-pan";
import { useCanvasZoom } from "./use-canvas-zoom";
import type { PlanClient } from "./use-plan";
import { useRevealCard } from "./use-reveal-card";
import { useSize } from "./use-size";
import { ZoomControls } from "./zoom-controls";

// Track collapse is a view choice, like milestone collapse, so it stays local to the open timeline.
function useCollapsedTracks() {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const toggle = (trackId: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (!next.delete(trackId)) {
        next.add(trackId);
      }
      return next;
    });
  return { collapsed, toggle };
}

// Place the visible tickets, leaving out collapsed milestones and collapsed tracks.
function useGraphBox(
  sections: PlanViewProps["sections"],
  tracks: PlanViewProps["tracks"],
  collapsed: ReadonlySet<string>,
) {
  const layout = useMemo(
    () =>
      layoutGraph(
        sections.map(({ section, rows, collapsed: closed }) => ({
          deadlineId: section.deadline?.id ?? null,
          collapsed: closed,
          rows,
        })),
        {
          tracks: tracks.list.length,
          trackOf: tracks.indexOf,
          collapsedTracks: new Set(tracks.list.flatMap((track, index) => (collapsed.has(track.id) ? [index] : []))),
        },
      ),
    [sections, tracks, collapsed],
  );
  const box = useMemo(
    () => geometry(layout, new Map(sections.flatMap(({ rows }) => rows).map((row) => [row.id, nodeSize(row)]))),
    [layout, sections],
  );
  const trackAt = (x: number) => {
    const index = box.tracks.findIndex((entry) => x >= entry.x && x <= entry.x + entry.width);
    const id = tracks.list[Math.max(0, index)]?.id;
    return id === "unassigned" ? null : id;
  };
  const rows = sections
    .flatMap((entry) => (entry.collapsed ? [] : entry.rows))
    .filter(({ id }) => box.positions.has(id));
  return { box, trackAt, rows };
}

export function PlanGraph(props: PlanViewProps & { client: PlanClient; squareArrows: boolean }) {
  const { sections, tracks, selectedId, ...actions } = props;
  const { ref, width, height } = useSize();
  const { panning, handlers } = useCanvasPan(ref);
  const { zoom, change } = useCanvasZoom(ref);
  const [scrollLeft, setScrollLeft] = useState(0);
  const { collapsed, toggle } = useCollapsedTracks();
  const { box, trackAt, rows } = useGraphBox(sections, tracks, collapsed);
  const sourceTrackId = sections.flatMap(({ section }) => section.rows).find(({ id }) => id === props.dragId)?.trackId;
  const region = dropRegion(
    box,
    tracks.list.map(({ id }) => id),
    props.dropTarget,
    sourceTrackId,
  );
  useRevealCard({ ref, selectedId, box, zoom });
  const canvasWidth = Math.max(box.width + newTrackWidth, width / zoom);
  // Tracks run to the bottom of the panel even when milestones are collapsed.
  const canvasHeight = Math.max(box.height, height / zoom - trackHeaderHeight);

  return (
    <Box h="full" minH="0" minW="0" position="relative">
      <Box
        ref={ref}
        data-timeline-viewport
        h="full"
        minH="0"
        minW="0"
        overflow="hidden"
        position="relative"
        isolation="isolate"
        cursor={panning ? "grabbing" : "grab"}
        userSelect={panning ? "none" : undefined}
        touchAction="none"
        role="region"
        aria-label="Ticket timeline canvas"
        tabIndex={0}
        {...handlers}
        onScroll={(event) => setScrollLeft(event.currentTarget.scrollLeft)}
      >
        <Box style={{ zoom }} w={`${canvasWidth}px`}>
          <TrackHeader
            tracks={tracks.list}
            boxes={box.tracks}
            width={canvasWidth}
            contentLeft={box.contentLeft}
            collapsed={collapsed}
            targetTrackId={region?.trackId}
            onToggle={toggle}
            onRename={actions.onRenameTrack}
            onNewTrack={actions.onNewTrack}
          />
          <GraphContent
            props={props}
            client={props.client}
            squareArrows={props.squareArrows}
            region={region}
            graph={{ box, trackAt, rows }}
            collapsed={collapsed}
            viewport={{
              width: width / zoom,
              canvasWidth,
              canvasHeight,
              zoom,
              headerLeft: visibleContentLeft(box.contentLeft, scrollLeft, zoom),
            }}
          />
        </Box>
      </Box>
      <ZoomControls zoom={zoom} onChange={change} />
    </Box>
  );
}
