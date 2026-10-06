import { Box, Flex, Stack } from "@chakra-ui/react";
import type { SceneProps } from "motion-lab/kit";
import { Composer, duration, Message, progress, reveal, SessionWindow, timings } from "motion-lab/kit";
import { ComposerEdge, TurnStatus } from "./turn-status";

const answer =
  "I’ll build the motion examples in design/motion and make them available in the Motion Lab extension. Each example will use the same visual language as Prompt Studio.";
const words = answer.match(/\S+\s*/g) ?? [];
const send = 1;
const wait = 1.3;
const firstResponse = 3;
const complete = 9;
const wordsPerSecond = 7;

// Words appear in reading order and fade in briefly, so lines grow without characters flickering.
const StreamedReply = (props: SceneProps) => {
  const { time } = props;
  const fade = duration(props, timings.textChunk);
  return words.map((word, index) => {
    const at = firstResponse + index / wordsPerSecond;
    if (time < at) return null;
    return (
      <Box as="span" key={index} opacity={progress(time, at, fade)}>
        {word}
      </Box>
    );
  });
};

export const ChatTurn = (props: SceneProps) => {
  const { time, variant } = props;
  // Only the rise style moves messages; the others fade in place.
  const rise = variant.values.turn === "rise" ? 4 : 0;
  return (
    <SessionWindow>
      <Flex direction="column" h="full" minH="0" gap="0">
        <Stack flex="1" minH="0" overflow="hidden" p="sm" gap="0">
          <Message>We can explore the chat and workbench together.</Message>
          <Box {...reveal(props, send, timings.message, rise)}>
            <Message user>Build a set of motion studies for Prompt Studio.</Message>
          </Box>
          {time >= firstResponse && (
            <Box {...reveal(props, firstResponse, timings.firstResponse, rise / 2)}>
              <Message>
                <StreamedReply {...props} />
              </Message>
            </Box>
          )}
        </Stack>
        <Box position="relative" flexShrink="0">
          <Composer
            working={time >= send && time < complete}
            status={<TurnStatus {...props} start={wait} end={complete} elapsedFrom={send} />}
          />
          {variant.values.turn === "edge" && <ComposerEdge {...props} start={wait} end={complete} />}
        </Box>
      </Flex>
    </SessionWindow>
  );
};

export default ChatTurn;
