// Name each track above the graph with an editable name and a collapse toggle, offer a new track,
// and draw track separators and collapsed track columns.
import { Box, Button, Flex, IconButton, Text } from "@chakra-ui/react";
import { Tooltip } from "@pstdio/ui";
import { ChevronsLeftRight, ChevronsRightLeft, Plus } from "lucide-react";
import type { Track } from "../model/tracks";
import { gutterWidth, padding, type TrackBox, trackGap, trackHeaderHeight } from "./graph-geometry";
import { graphLayers } from "./graph-layers";
import { InlineText } from "./inline-edit";

interface TrackHeaderProps {
  tracks: Track[];
  boxes: TrackBox[];
  width: number;
  contentLeft: number;
  collapsed: ReadonlySet<string>;
  targetTrackId?: string;
  onToggle: (trackId: string) => void;
  onRename: (trackId: string, name: string) => Promise<unknown>;
  onNewTrack: () => void;
}

function TrackName(props: { track: Track } & Pick<TrackHeaderProps, "onRename">) {
  const { track, onRename } = props;
  // Unassigned is not a Track value, so it cannot be renamed.
  if (track.id === "unassigned") {
    return (
      <Text textStyle="label/S/medium" color="fg.muted" truncate minW="0" px="2xs">
        {track.label}
      </Text>
    );
  }

  return (
    <InlineText
      value={track.label}
      label={`${track.label} track name`}
      color="fg.muted"
      onSave={(name) => onRename(track.id, name)}
    />
  );
}

// Each name stays at the visible edge of its track until the next track reaches it.
export function TrackHeader(props: TrackHeaderProps) {
  const { tracks, boxes, width, contentLeft, collapsed, targetTrackId, onToggle, onRename, onNewTrack } = props;
  const right = Math.max(contentLeft, ...boxes.map((box) => box.x + box.width));
  return (
    <Box position="sticky" top="0" zIndex={graphLayers.tracks} w={`${width}px`} h={`${trackHeaderHeight}px`} bg="bg">
      <Box position="sticky" left="0" zIndex="1" w={`${gutterWidth}px`} h="full" bg="bg" />
      {tracks.map((track, index) =>
        collapsed.has(track.id) ? (
          <Flex
            key={track.id}
            position="absolute"
            left={`${boxes[index].x}px`}
            w={`${boxes[index].width}px`}
            top="4px"
            bg={targetTrackId === track.id ? "border.accent/6" : undefined}
            boxShadow={targetTrackId === track.id ? "inset 0 -1px var(--chakra-colors-border-accent)" : undefined}
            justify="center"
          >
            <Tooltip content={`Expand ${track.label}`}>
              <IconButton
                size="2xs"
                variant="ghost"
                color="fg.subtle"
                aria-label={`Expand ${track.label}`}
                onClick={() => onToggle(track.id)}
              >
                <ChevronsLeftRight size={12} />
              </IconButton>
            </Tooltip>
          </Flex>
        ) : null,
      )}
      {tracks.map((track, index) => {
        if (collapsed.has(track.id)) {
          return null;
        }

        return (
          <Flex
            key={track.id}
            position="absolute"
            left={`${boxes[index].x}px`}
            w={`${boxes[index].width}px`}
            top="4px"
            bg={targetTrackId === track.id ? "border.accent/6" : undefined}
            boxShadow={targetTrackId === track.id ? "inset 0 -1px var(--chakra-colors-border-accent)" : undefined}
            role="group"
            aria-label={`${track.label} track header`}
          >
            <Flex position="sticky" left={`${gutterWidth}px`} align="center" gap="2xs" minW="0" maxW="full">
              <TrackName track={track} onRename={onRename} />
              <Tooltip content={`Collapse ${track.label}`}>
                <IconButton
                  size="2xs"
                  variant="ghost"
                  color="fg.subtle"
                  flexShrink="0"
                  aria-label={`Collapse ${track.label}`}
                  onClick={() => onToggle(track.id)}
                >
                  <ChevronsRightLeft size={12} />
                </IconButton>
              </Tooltip>
            </Flex>
          </Flex>
        );
      })}
      <Button
        position="absolute"
        left={`${right + trackGap}px`}
        top="4px"
        size="2xs"
        variant="ghost"
        color="fg.subtle"
        onClick={onNewTrack}
      >
        <Plus size={12} />
        New track
      </Button>
    </Box>
  );
}

// Separators divide the expanded tracks; collapsed tracks already have shaded columns.
export function TrackLines(props: { boxes: TrackBox[]; height: number; contentLeft: number }) {
  const { boxes, height, contentLeft } = props;
  return boxes
    .filter((box) => box.x > contentLeft)
    .sort((a, b) => a.x - b.x)
    .slice(1)
    .map((box) => (
      <Box
        key={box.x}
        position="absolute"
        top="0"
        left={`${box.x - trackGap / 2}px`}
        h={`${height}px`}
        borderLeftWidth="1px"
        borderStyle="dashed"
        borderColor="border.subtle"
      />
    ));
}

interface CollapsedColumnsProps {
  tracks: Track[];
  boxes: TrackBox[];
  height: number;
  collapsed: ReadonlySet<string>;
}

// Collapsed tracks move with the canvas; vertical names stay visible while panning down.
export function CollapsedColumns(props: CollapsedColumnsProps) {
  const { tracks, boxes, height, collapsed } = props;
  return tracks.map((track, index) =>
    collapsed.has(track.id) ? (
      <Flex
        key={track.id}
        position="absolute"
        top="0"
        left={`${boxes[index].x}px`}
        w={`${boxes[index].width}px`}
        h={`${height}px`}
        direction="column"
        zIndex="1"
        bg="bg.subtle"
        pointerEvents="none"
      >
        <Text
          position="sticky"
          top={`${trackHeaderHeight + padding}px`}
          mt={`${padding}px`}
          alignSelf="center"
          writingMode="vertical-rl"
          textStyle="label/S/medium"
          color="fg.muted"
          whiteSpace="nowrap"
        >
          {track.label}
        </Text>
      </Flex>
    ) : null,
  );
}
