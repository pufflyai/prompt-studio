// Show the plan as a dependency graph: the milestone timeline runs down the left, execution order runs down,
// parallel work sits side by side, each milestone is a band, and collapsible tracks split every band into columns.
import { Box } from "@chakra-ui/react";
import { Canvas } from "@pstdio/ui/canvas";
import type { RefObject } from "react";
import { layoutGraph } from "../model/graph-layout";
import { dropRegion } from "./drop-region";
import { GraphContent } from "./graph-content";
import { geometry, newTrackWidth, trackHeaderHeight } from "./graph-geometry";
import { TrackHeader } from "./graph-tracks";
import type { PlanViewProps } from "./plan-view";
import { useTimelinePresentation } from "./timeline-presentation";
import { useCardHeights } from "./use-card-heights";
import { useRevealCard } from "./use-reveal-card";
import { useSize } from "./use-size";
import { useTimelineCamera } from "./use-timeline-camera";

// Place the visible tickets, leaving out collapsed milestones and collapsed tracks.
function useGraphBox(
  sections: PlanViewProps["sections"],
  tracks: PlanViewProps["tracks"],
  collapsed: ReadonlySet<string>,
  ref: RefObject<HTMLDivElement | null>,
) {
  const layout = layoutGraph(
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
  );
  const heights = useCardHeights(ref, layout.nodes.map(({ id }) => id).join(","));
  const box = geometry(layout, heights);
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

export function PlanGraph(props: PlanViewProps) {
  const { sections, tracks, selectedId, ...actions } = props;
  const { ref, width, height } = useSize();
  const { zoom, pan, changeZoom } = useTimelineCamera(ref);
  const presentation = useTimelinePresentation();
  const collapsed = new Set(presentation.value.collapsedTracks);
  const toggle = (id: string) => presentation.toggle("collapsedTracks", id);
  const { box, trackAt, rows } = useGraphBox(sections, tracks, collapsed, ref);
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
    <Canvas
      ref={ref}
      data-timeline-viewport
      aria-label="Project Timeline canvas"
      variant="pan"
      zoom={zoom}
      onPan={pan}
      onZoom={changeZoom}
    >
      <Box css={{ zoom }} w={`${canvasWidth}px`} data-timeline-content>
        <TrackHeader
          tracks={tracks.list}
          boxes={box.tracks}
          width={canvasWidth}
          contentLeft={box.contentLeft}
          collapsed={collapsed}
          onToggle={toggle}
          onRename={actions.onRenameTrack}
          onNewTrack={actions.onNewTrack}
        />
        <GraphContent
          props={props}
          region={region}
          graph={{ box, trackAt, rows }}
          collapsed={collapsed}
          viewport={{
            ref,
            width: width / zoom,
            height: height / zoom,
            canvasWidth,
            canvasHeight,
            zoom,
          }}
        />
      </Box>
    </Canvas>
  );
}
