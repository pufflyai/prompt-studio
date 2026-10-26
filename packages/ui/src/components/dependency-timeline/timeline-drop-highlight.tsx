import type { DependencyTimelineProps } from "./dependency-timeline.types";
import { type geometry, gutterWidth } from "./timeline-geometry";
import {
  TimelineHighlight,
  TimelineHighlightCell,
  TimelineHighlightRow,
  TimelineHighlightTrack,
} from "./timeline-parts";

interface HighlightProps extends Pick<DependencyTimelineProps, "dropTarget" | "tracks" | "sections" | "draggedId"> {
  box: ReturnType<typeof geometry>;
  width: number;
  height: number;
}

export const DropHighlight = (props: HighlightProps) => {
  const { box, dropTarget, sections, tracks, draggedId, width, height } = props;
  if (!dropTarget) return null;
  const band = box.bands.find(({ sectionId }) => sectionId === dropTarget.sectionId);
  if (!band) return null;
  const trackId =
    dropTarget.trackId ?? sections.flatMap(({ items }) => items).find(({ id }) => id === draggedId)?.trackId;
  const track = box.tracks[tracks.findIndex(({ id }) => id === trackId)];
  return (
    <TimelineHighlight aria-hidden="true">
      <TimelineHighlightRow
        data-drop-milestone={band.sectionId ?? "unassigned"}
        top={`${band.top}px`}
        w={`${width - gutterWidth}px`}
        h={`${band.height}px`}
      />
      {track ? (
        <>
          <TimelineHighlightTrack
            data-drop-track={trackId}
            left={`${track.x}px`}
            w={`${track.width}px`}
            h={`${height}px`}
          />
          <TimelineHighlightCell
            data-drop-cell
            left={`${track.x}px`}
            top={`${band.bodyTop}px`}
            w={`${track.width}px`}
            h={`${band.top + band.height - band.bodyTop}px`}
          />
        </>
      ) : null}
    </TimelineHighlight>
  );
};
