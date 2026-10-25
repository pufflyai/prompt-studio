import type { RefObject } from "react";
import type { DependencyTimelineProps } from "./dependency-timeline.types";
import { DropHighlight } from "./timeline-drop-highlight";
import { TimelineEdges } from "./timeline-edges";
import { type geometry, gutterWidth, trackAt, visibleContentLeft } from "./timeline-geometry";
import { MilestoneGutter } from "./timeline-gutter";
import { TimelineItems } from "./timeline-items";
import { TimelineSurface } from "./timeline-parts";
import { TimelineSections } from "./timeline-sections";
import { TrackColumns } from "./timeline-tracks";
import { graphWindow, visibleGraphRows } from "./timeline-window";
import { useTimelineWindow } from "./use-timeline-window";

interface ContentProps extends DependencyTimelineProps {
  box: ReturnType<typeof geometry>;
  viewport: RefObject<HTMLDivElement | null>;
  width: number;
  height: number;
  canvasWidth: number;
  canvasHeight: number;
  zoom: number;
}

export const TimelineContent = (props: ContentProps) => {
  const {
    viewport,
    box,
    width,
    height,
    canvasWidth,
    canvasHeight,
    zoom,
    sections,
    tracks,
    selectedId,
    draggedId,
    onContext,
  } = props;
  const window = useTimelineWindow(viewport);
  const headerLeft = visibleContentLeft(box.contentLeft, window.left, zoom);
  const bounds = graphWindow({ ...window, width, height, zoom });
  const items = sections.flatMap(({ items }) => items).filter(({ id }) => box.positions.has(id));
  const visible = visibleGraphRows(items, box.positions, bounds, new Set([selectedId, draggedId, window.focusedId]));
  return (
    <TimelineSurface
      w={`${canvasWidth}px`}
      h={`${canvasHeight}px`}
      onContextMenu={(event) => {
        if (
          !onContext ||
          (event.target as HTMLElement).closest(
            "[data-canvas-control],button,input,[role=menuitem],[data-part=preview]",
          )
        )
          return;
        const rect = event.currentTarget.getBoundingClientRect();
        const viewportX = (event.clientX - viewport.current!.getBoundingClientRect().left) / zoom;
        if (viewportX < gutterWidth) return;
        event.preventDefault();
        const x = (event.clientX - rect.left) / zoom;
        const y = (event.clientY - rect.top) / zoom;
        const band = box.bands.find((band) => y >= band.top && y <= band.top + band.height);
        onContext({
          x: event.clientX,
          y: event.clientY,
          trackId: trackAt(box.tracks, tracks, x),
          sectionId: band?.sectionId,
        });
      }}
    >
      <MilestoneGutter {...props} bands={box.bands} height={canvasHeight} contentLeft={box.contentLeft} />
      <TrackColumns tracks={tracks} boxes={box.tracks} height={canvasHeight} contentLeft={box.contentLeft} />
      <DropHighlight {...props} width={canvasWidth} height={canvasHeight} />
      <TimelineSections {...props} width={width / zoom} headerLeft={headerLeft} />
      <TimelineEdges
        bounds={bounds}
        items={items}
        positions={box.positions}
        width={box.width}
        height={box.height}
        selectedId={selectedId}
      />
      <TimelineItems {...props} items={visible} />
    </TimelineSurface>
  );
};
