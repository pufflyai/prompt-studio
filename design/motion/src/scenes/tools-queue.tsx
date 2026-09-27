import { Box, Flex, HStack, Stack, Text } from "@chakra-ui/react";
import { GripVertical, Pencil, Trash2 } from "lucide-react";
import type { SceneProps } from "../model";
import { duration, reveal, track } from "../motion";
import { timings } from "../presets";
import { Activity, Composer, Message } from "../scene-ui";
import { SessionWindow } from "../session-window";
import { ToolTimeline } from "../tool-timeline";

const QueueRow = (props: SceneProps & { start: number; end: number; text: string }) => {
  const { time, start, end, text } = props;
  const height = track(time, [
    { at: start, value: 36, duration: duration(props, timings.rowSpace, true) },
    { at: end, value: 0, duration: duration(props, timings.rowRemove, true) },
  ]);
  const opacity = track(time, [
    { at: start + duration(props, timings.rowSpace, true), value: 1, duration: duration(props, timings.rowFade) },
    { at: end, value: 0, duration: duration(props, timings.rowFade) },
  ]);
  return (
    <Box h={`${height}px`} overflow="hidden">
      <HStack h="9" px="xs" gap="xs" borderWidth="1px" borderBottomWidth="0" borderColor="border" opacity={opacity}>
        <GripVertical size={14} />
        <Text textStyle="label/S/regular" flex="1">
          {text}
        </Text>
        <Pencil size={14} />
        <Trash2 size={14} />
      </HStack>
    </Box>
  );
};
export const ToolsQueue = (props: SceneProps) => {
  const { time } = props;
  return (
    <SessionWindow>
      <Flex direction="column" h="full" minH="0" gap="0">
        <Stack flex="1" minH="0" overflow="hidden" p="sm" gap="sm">
          <Message user>Inspect the folder and prepare the motion examples.</Message>
          <Box {...reveal(props, 1, 140)}>
            <ToolTimeline {...props} expand={2} finish={8} />
          </Box>
          <Box {...reveal(props, 10, timings.message, 4)}>
            <Message user>Also compare reduced motion.</Message>
            <Message>I’ll keep status visible while removing movement.</Message>
          </Box>
        </Stack>
        <Box h="16" position="relative" flexShrink="0">
          <Box position="absolute" inset="0">
            <Activity {...props} start={1} end={8} />
          </Box>
          <Box position="absolute" inset="0">
            <Activity {...props} start={10} end={13} />
          </Box>
        </Box>
        <Composer
          working={(time >= 1 && time < 8) || (time >= 10 && time < 13)}
          hasQueue={time >= 4 && time < 10}
          queue={
            <Box>
              <QueueRow {...props} start={4} end={7} text="Try a slower panel reveal." />
              <QueueRow {...props} start={5.5} end={10} text="Also compare reduced motion." />
            </Box>
          }
        />
      </Flex>
    </SessionWindow>
  );
};
