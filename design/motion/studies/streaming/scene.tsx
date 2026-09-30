import { Box, Flex, Stack } from "@chakra-ui/react";
import type { SceneProps } from "motion-lab/kit";
import { Composer, duration, Message, progress, responseChunks, SceneWindow, timings, track } from "motion-lab/kit";

const StreamingChunk = (props: SceneProps & { chunk: (typeof responseChunks)[number] }) => {
  const { chunk, time, variant, reducedMotion } = props;
  if (time < chunk.at) return null;
  const animated = !reducedMotion && variant.preset !== "instant";
  const fade = animated && variant.values.streaming === "fade";
  const words = animated && variant.values.streaming === "words";
  const tokens = chunk.text.match(/\S+\s*|\s+/g) ?? [];
  const revealDuration = duration(props, timings.textWords);
  return (
    <Box
      as="span"
      fontFamily={chunk.code ? "mono" : "body"}
      bg={chunk.code ? "bg.code" : undefined}
      opacity={fade ? progress(time, chunk.at, duration(props, timings.textChunk)) : 1}
    >
      {words
        ? tokens.map((word, index) => (
            <Box
              as="span"
              key={index}
              opacity={progress(
                time,
                chunk.at + ((index / Math.max(1, tokens.length - 1)) * revealDuration * 2) / 3,
                revealDuration / 3,
              )}
            >
              {word}
            </Box>
          ))
        : chunk.text}
    </Box>
  );
};

export const Streaming = (props: SceneProps) => {
  const { time } = props;
  const y = track(time, [
    { at: 0, value: -480, duration: 0 },
    { at: 5, value: -580, duration: duration(props, 140, true) },
    { at: 7, value: 0, duration: 0 },
    { at: 11, value: -760, duration: duration(props, 160, true) },
  ]);
  return (
    <SceneWindow title="Review motion studies">
      <Flex direction="column" h="full" minH="0" gap="0">
        <Box flex="1" minH="0" px="sm" overflow="hidden" position="relative">
          <Stack transform={`translateY(${y}px)`} gap="0">
            <Stack h="480px" flexShrink="0" gap="sm" pt="sm">
              <Message user>We want the app to feel smoother without adding distractions.</Message>
              <Message>Let’s review short, repeatable sequences before changing the app.</Message>
              <Message user>Start with chat. Keep the composer and earlier messages stable.</Message>
            </Stack>
            <Message user>Describe how we will review the motion examples.</Message>
            <Box whiteSpace="pre-wrap" textStyle="paragraph/S/regular" px="xs">
              {responseChunks.map((chunk) => (
                <StreamingChunk key={chunk.at} {...props} chunk={chunk} />
              ))}
            </Box>
          </Stack>
        </Box>
        <Composer working={time >= 1 && time < 11} />
      </Flex>
    </SceneWindow>
  );
};

export default Streaming;
