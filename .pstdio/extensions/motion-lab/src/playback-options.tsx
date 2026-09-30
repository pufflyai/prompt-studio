import { Button, HStack, IconButton, Text } from "@chakra-ui/react";
import { SegmentedControl, Slider, Tooltip } from "@pstdio/ui";
import { Repeat } from "lucide-react";
import { FPS } from "./kit/model";
import { usePlaybackPosition, useReview } from "./review-context";
import { loopBounds } from "./review-state";

export const PlaybackOptions = () => {
  const { state, update } = useReview();
  return (
    <HStack gap="2xs" flexShrink="0">
      <SegmentedControl
        size="xs"
        aria-label="Playback speed"
        value={String(state.rate)}
        options={[
          { value: "0.5", label: "0.5×" },
          { value: "1", label: "1×" },
          { value: "2", label: "2×" },
        ]}
        onValueChange={(value) => void update({ rate: Number(value) })}
      />
      <Tooltip content="Loop" openDelay={300} closeDelay={150}>
        <IconButton
          size="xs"
          variant={state.loop ? "primary" : "ghost"}
          aria-label="Loop"
          aria-pressed={state.loop}
          onClick={() => void update({ loop: !state.loop })}
        >
          <Repeat size={14} />
        </IconButton>
      </Tooltip>
    </HStack>
  );
};

export const LoopRange = () => {
  const { state, study, preview, update } = useReview();
  const { frame } = usePlaybackPosition(state, study.duration);
  const { start, end, max } = loopBounds(state, study.duration);
  if (!state.loop) return null;
  return (
    <>
      <HStack justify="space-between" gap="xs" flexWrap="wrap">
        <Text textStyle="label/XS/regular" color="fg.muted" fontVariantNumeric="tabular-nums">
          Loop {(start / FPS).toFixed(2)}–{(end / FPS).toFixed(2)}s
        </Text>
        <HStack gap="2xs">
          <Button
            size="xs"
            variant="ghost"
            disabled={frame >= end}
            onClick={() => void update({ loopRange: [frame, end] })}
          >
            Set start here
          </Button>
          <Button
            size="xs"
            variant="ghost"
            disabled={frame <= start}
            onClick={() => void update({ loopRange: [start, frame] })}
          >
            Set end here
          </Button>
          <Button size="xs" variant="ghost" onClick={() => void update({ loopRange: [0, max] })}>
            Reset range
          </Button>
        </HStack>
      </HStack>
      <Slider
        aria-label={["Loop start", "Loop end"]}
        thumbAlignment="center"
        min={0}
        max={max}
        step={1}
        minStepsBetweenThumbs={1}
        value={[start, end]}
        onValueChange={({ value }) => preview({ loopRange: [value[0], value[1]] })}
        onValueChangeEnd={({ value }) => void update({ loopRange: [value[0], value[1]] })}
      />
    </>
  );
};
