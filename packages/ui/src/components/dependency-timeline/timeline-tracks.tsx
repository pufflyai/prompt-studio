import { Button, IconButton } from "@chakra-ui/react";
import { ChevronsLeftRight, ChevronsRightLeft, Plus } from "lucide-react";
import { Tooltip } from "../primitives/tooltip";
import type { DependencyTimelineProps } from "./dependency-timeline.types";
import { gutterWidth, type TrackBox, trackGap } from "./timeline-geometry";
import {
  TimelineColumn,
  TimelineColumnLabel,
  TimelineGutterCorner,
  TimelineSeparator,
  TimelineTrack,
  TimelineTrackLabel,
  TimelineTrackName,
  TimelineTracks,
} from "./timeline-parts";

interface TrackHeaderProps extends Pick<DependencyTimelineProps, "tracks" | "onToggleTrack" | "onAddTrack"> {
  boxes: TrackBox[];
  width: number;
  contentLeft: number;
}

export const TrackHeader = (props: TrackHeaderProps) => {
  const { tracks, boxes, width, contentLeft, onToggleTrack, onAddTrack } = props;
  const right = Math.max(contentLeft, ...boxes.map((box) => box.x + box.width));
  return (
    <TimelineTracks w={`${width}px`} data-canvas-control>
      <TimelineGutterCorner />
      {tracks.map((track, index) => (
        <TimelineTrack
          key={track.id}
          left={`${boxes[index].x}px`}
          w={`${boxes[index].width}px`}
          justifyContent={track.collapsed ? "center" : undefined}
          role="group"
          aria-label={`${track.label} track header`}
        >
          {track.collapsed ? (
            <Tooltip content={`Expand ${track.label}`}>
              <IconButton
                size="2xs"
                variant="ghost"
                aria-label={`Expand ${track.label}`}
                onClick={() => onToggleTrack?.(track.id)}
              >
                <ChevronsLeftRight />
              </IconButton>
            </Tooltip>
          ) : (
            <TimelineTrackName>
              {track.name ?? <TimelineTrackLabel>{track.label}</TimelineTrackLabel>}
              {onToggleTrack ? (
                <Tooltip content={`Collapse ${track.label}`}>
                  <IconButton
                    size="2xs"
                    variant="ghost"
                    aria-label={`Collapse ${track.label}`}
                    onClick={() => onToggleTrack(track.id)}
                  >
                    <ChevronsRightLeft />
                  </IconButton>
                </Tooltip>
              ) : null}
            </TimelineTrackName>
          )}
        </TimelineTrack>
      ))}
      {onAddTrack ? (
        <Button
          position="absolute"
          left={`${right + trackGap}px`}
          top="2xs"
          size="2xs"
          variant="ghost"
          onClick={onAddTrack}
        >
          <Plus />
          New track
        </Button>
      ) : null}
    </TimelineTracks>
  );
};

interface TrackColumnsProps {
  tracks: DependencyTimelineProps["tracks"];
  boxes: TrackBox[];
  height: number;
  contentLeft: number;
}

export const TrackColumns = (props: TrackColumnsProps) => {
  const { tracks, boxes, height, contentLeft } = props;
  const separators = boxes
    .filter((box) => box.x > contentLeft)
    .sort((a, b) => a.x - b.x)
    .slice(1);
  return (
    <>
      {tracks.map((track, index) =>
        track.collapsed ? (
          <TimelineColumn key={track.id} left={`${boxes[index].x}px`} w={`${boxes[index].width}px`} h={`${height}px`}>
            <TimelineColumnLabel>{track.label}</TimelineColumnLabel>
          </TimelineColumn>
        ) : null,
      )}
      {separators.map((box) => (
        <TimelineSeparator key={box.x} left={`${box.x - trackGap / 2}px`} h={`${height}px`} />
      ))}
    </>
  );
};

export const trackAt = (boxes: TrackBox[], tracks: DependencyTimelineProps["tracks"], x: number) => {
  if (x < gutterWidth) return undefined;
  const index = boxes.findIndex((box) => x >= box.x && x <= box.x + box.width);
  return tracks[Math.max(0, index)]?.id;
};
