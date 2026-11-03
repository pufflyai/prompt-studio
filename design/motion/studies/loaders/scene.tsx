import { Box, Flex, Stack, Text } from "@chakra-ui/react";
import type { SceneProps } from "../../kit";
import { Activity, Composer, Message, reveal, SessionWindow, ToolTimeline, timings } from "../../kit";

const Loaders = (props: SceneProps) => {
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

export default Loaders;
