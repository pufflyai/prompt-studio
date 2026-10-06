import { Box, HStack, Spinner, Text } from "@chakra-ui/react";
import type { SceneProps } from "motion-lab/kit";
import { duration, progress, timings, track } from "motion-lab/kit";

const edgeCycleSeconds = 2.2;

// The status sits beside the workspace name, so the message list never shifts when a turn starts or ends.
// When the turn completes, its duration stays as a quiet record of the work.
export const TurnStatus = (props: SceneProps & { start: number; end: number; elapsedFrom: number }) => {
  const { time, start, end, elapsedFrom, reducedMotion } = props;
  if (time < start) return null;
  const fade = duration(props, timings.loader);
  if (time >= end) {
    return (
      <Text textStyle="label/XS/regular" color="fg.muted" opacity={progress(time, end, fade)}>
        Worked for {Math.floor(end - elapsedFrom)}s
      </Text>
    );
  }
  const local = reducedMotion ? 0 : time - start;
  return (
    <HStack gap="2xs" color="fg.muted" opacity={progress(time, start, fade)}>
      <Box transform={`rotate(${local * 360}deg)`} display="flex">
        <Spinner size="xs" color="fg.muted" />
      </Box>
      <Text textStyle="label/XS/regular" fontFamily="mono" fontVariantNumeric="tabular-nums">
        {Math.floor(time - elapsedFrom)}s
      </Text>
    </HStack>
  );
};

// A glint travels along the composer's top border. It is inset past the rounded corners so the border stays whole.
export const ComposerEdge = (props: SceneProps & { start: number; end: number }) => {
  const { time, start, end, reducedMotion } = props;
  if (time < start) return null;
  const opacity = track(time, [
    { at: start, value: 1, duration: duration(props, timings.loader) },
    { at: end, value: 0, duration: duration(props, timings.loader) },
  ]);
  const travel = reducedMotion ? 0.5 : ((time - start) % edgeCycleSeconds) / edgeCycleSeconds;
  return (
    <Box position="absolute" top="0" insetX="2xs" px="sm" pointerEvents="none" opacity={opacity}>
      <Box position="relative" h="1px" overflow="hidden">
        <Box
          position="absolute"
          insetY="0"
          w="40%"
          left={`${-40 + travel * 140}%`}
          bgGradient="to-r"
          gradientFrom="transparent"
          gradientVia="fg.muted"
          gradientTo="transparent"
        />
      </Box>
    </Box>
  );
};
