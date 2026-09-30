import { Box, Flex, Stack, Text } from "@chakra-ui/react";
import type { SceneProps } from "motion-lab/kit";
import { Activity, Composer, Message, reveal, SessionWindow, ToolTimeline, timings } from "motion-lab/kit";

export const ChatTurn = (props: SceneProps) => {
  const { time } = props;
  const answer =
    "I’ll build the motion examples in design/motion and make them available in the Motion Lab extension. Each example will use the same visual language as Prompt Studio.";
  const text = answer.slice(0, Math.max(0, Math.floor((time - 3) * 38)));
  return (
    <SessionWindow>
      <Flex direction="column" h="full" minH="0" gap="0">
        <Stack flex="1" minH="0" overflow="hidden" p="sm" gap="sm">
          <Message>We can explore the chat and workbench together.</Message>
          <Box {...reveal(props, 1, timings.message, 4)}>
            <Message user>Build a set of motion studies for Prompt Studio.</Message>
          </Box>
          <Box {...reveal(props, 3, timings.firstResponse)}>
            <Message>{text}</Message>
          </Box>
        </Stack>
        <Box h="16" flexShrink="0" position="relative">
          <Box position="absolute" inset="0">
            <Activity {...props} start={1.3} elapsedFrom={1} end={9} />
          </Box>
        </Box>
        <Composer working={time >= 1 && time < 9} />
      </Flex>
    </SessionWindow>
  );
};
export const Loaders = (props: SceneProps) => {
  const { time } = props;
  const active = (time >= 1 && time < 1.2) || (time >= 2 && time < 7) || (time >= 8.5 && time < 12);
  return (
    <SessionWindow>
      <Flex direction="column" h="full" minH="0" gap="0">
        <Stack flex="1" minH="0" overflow="hidden" p="sm" gap="sm">
          <Message user>Check the motion studies and describe the changes.</Message>
          <Box {...reveal(props, 1.2, timings.firstResponse)}>
            <Message>I’ll inspect the study files, then compare the rendered frames.</Message>
          </Box>
          <Box {...reveal(props, 2, timings.message)}>
            <ToolTimeline {...props} expand={3} finish={6} />
          </Box>
          {time >= 7 && time < 8.5 && (
            <Text textStyle="label/XS/regular" color="fg.muted">
              Stopped
            </Text>
          )}
          <Box {...reveal(props, 8.5, timings.message, 4)}>
            <Message user>Continue with the visual review.</Message>
          </Box>
          <Box {...reveal(props, 12, timings.firstResponse)}>
            <Message>The tool rows and workspace controls now follow the current app layout.</Message>
          </Box>
        </Stack>
        <Box h="16" position="relative" flexShrink="0">
          {[
            { start: 1, end: 1.2 },
            { start: 2, end: 7 },
            { start: 8.5, end: 12 },
          ].map((turn) => (
            <Box position="absolute" inset="0" key={turn.start}>
              <Activity {...props} {...turn} />
            </Box>
          ))}
        </Box>
        <Composer working={active} />
      </Flex>
    </SessionWindow>
  );
};

export default ChatTurn;
