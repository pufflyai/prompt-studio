import { Box, HStack, IconButton, Stack, Text } from "@chakra-ui/react";
import { FPS, getStudy } from "@pstdio/motion-studies";
import { Header, Slider, Tooltip } from "@pstdio/ui";
import { ChevronLeft, ChevronRight, Diamond, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { LoopRange, PlaybackOptions } from "./playback-options";
import { usePlaybackPosition, useReview } from "./review-context";
import { loopBounds } from "./review-state";

export const PlayerControls = () => {
  const { state, update } = useReview();
  const { frame, playing } = usePlaybackPosition(state);
  const definition = getStudy(state.settings.study);
  const { start, end, max } = loopBounds(state);
  const markers = definition.markers.map((marker) => Math.ceil(marker.at * FPS));
  const previous = markers.filter((marker) => marker < frame).at(-1);
  const next = markers.find((marker) => marker > frame);
  const seek = (next: number) => {
    void update({ frame: Math.max(0, Math.min(max, next)), playing: false });
  };
  const togglePlayback = () => {
    let nextFrame = frame;
    if (!playing && state.loop && (frame < start || frame >= end)) nextFrame = start;
    else if (!playing && frame === max) nextFrame = 0;
    void update({ playing: !playing, frame: nextFrame });
  };
  return (
    <Stack
      gap="0"
      flexShrink="0"
      bg="bg.panel"
      borderTopWidth="1px"
      borderColor="border.subtle"
      aria-label="Playback controls"
    >
      <Header px="sm" gap="xs" minW="0" borderBottomWidth="1px" borderColor="border.subtle">
        <HStack gap="2xs" flexShrink="0">
          <IconButton size="2xs" variant="ghost" aria-label="First frame" title="First frame" onClick={() => seek(0)}>
            <SkipBack size={14} />
          </IconButton>
          <IconButton
            size="2xs"
            variant="ghost"
            aria-label="Previous keyframe"
            title="Previous keyframe"
            disabled={previous === undefined}
            onClick={() => previous !== undefined && seek(previous)}
          >
            <ChevronLeft size={14} />
          </IconButton>
          <IconButton
            size="xs"
            variant="primary"
            aria-label={playing ? "Pause" : "Play"}
            title={playing ? "Pause" : "Play"}
            onClick={togglePlayback}
          >
            {playing ? <Pause size={14} /> : <Play size={14} />}
          </IconButton>
          <IconButton
            size="2xs"
            variant="ghost"
            aria-label="Next keyframe"
            title="Next keyframe"
            disabled={next === undefined}
            onClick={() => next !== undefined && seek(next)}
          >
            <ChevronRight size={14} />
          </IconButton>
          <IconButton size="2xs" variant="ghost" aria-label="Last frame" title="Last frame" onClick={() => seek(max)}>
            <SkipForward size={14} />
          </IconButton>
        </HStack>
        <Text textStyle="label/S/regular" color="fg.muted" fontVariantNumeric="tabular-nums" flex="1" minW="0" truncate>
          {(frame / FPS).toFixed(2)} / {definition.duration}s
        </Text>
        <PlaybackOptions />
      </Header>
      <Stack px="lg" pt="sm" pb="lg" gap="sm">
        <HStack justify="space-between" textStyle="label/XS/regular" color="fg.muted" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((tick) => (
            <Text key={tick}>{(definition.duration * tick) / 4}s</Text>
          ))}
        </HStack>
        <Box position="relative" h="6" aria-label="Timeline events">
          {definition.markers.map((marker) => (
            <Box
              key={marker.at}
              position="absolute"
              left={`${(Math.ceil(marker.at * FPS) / max) * 100}%`}
              transform="translateX(-50%)"
            >
              <Tooltip content={`${marker.at}s · ${marker.label}`} openDelay={300} closeDelay={150}>
                <IconButton
                  size="2xs"
                  variant="ghost"
                  aria-label={`${marker.at}s · ${marker.label}`}
                  onClick={() => seek(Math.ceil(marker.at * FPS))}
                >
                  <Diamond size={10} />
                </IconButton>
              </Tooltip>
            </Box>
          ))}
        </Box>
        <Slider
          aria-label={["Timeline"]}
          thumbAlignment="center"
          min={0}
          max={max}
          step={1}
          value={[frame]}
          onValueChange={(event) => seek(event.value[0])}
        />
        <LoopRange />
      </Stack>
    </Stack>
  );
};
