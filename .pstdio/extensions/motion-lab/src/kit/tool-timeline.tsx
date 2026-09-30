import { Box, HStack, Text, Timeline } from "@chakra-ui/react";
import { Check, ChevronDown, FileText, Terminal } from "lucide-react";
import type { SceneProps } from "./model";
import { duration, progress } from "./motion";
import { timings } from "./presets";

// Use the same tool slot recipe as chat's TimelineFromJSON. Its internal expansion
// state is interactive, so this study drives the detail clip from the frame instead.
export const ToolTimeline = (props: SceneProps & { expand: number; finish: number }) => {
  const { time, expand, finish } = props;
  const detail = progress(time, expand, duration(props, timings.details, true));
  const done = progress(time, finish, duration(props, timings.toolStatus));
  return (
    <Timeline.Root variant="tool">
      <Timeline.Item gap="xs">
        <Timeline.Connector>
          <Timeline.Separator />
          <Timeline.Indicator outline="none">
            <FileText size={14} strokeWidth={1} />
          </Timeline.Indicator>
        </Timeline.Connector>
        <Timeline.Content>
          <Timeline.Title fontWeight="normal">
            <Text textStyle="label/XS/regular">Read</Text>
            <Text textStyle="label/XS/regular" color="fg.muted">
              design/DESIGN.md
            </Text>
          </Timeline.Title>
        </Timeline.Content>
      </Timeline.Item>
      <Timeline.Item gap="xs">
        <Timeline.Connector>
          <Timeline.Indicator outline="none">
            <Box position="relative" boxSize="4">
              <Box position="absolute" opacity={1 - done}>
                <Terminal size={14} strokeWidth={1} />
              </Box>
              <Box position="absolute" opacity={done}>
                <Check size={14} strokeWidth={1} />
              </Box>
            </Box>
          </Timeline.Indicator>
        </Timeline.Connector>
        <Timeline.Content>
          <Timeline.Title fontWeight="normal">
            <HStack gap="xs" w="full">
              <Text textStyle="label/XS/regular">List motion studies</Text>
              <Text textStyle="label/XS/regular" color="fg.muted" flex="1">
                design/motion/src
              </Text>
              <Box transform={`rotate(${-180 * (1 - detail)}deg)`}>
                <ChevronDown size={12} />
              </Box>
            </HStack>
          </Timeline.Title>
          <Box h={`${detail * 112}px`} overflow="hidden">
            <Box
              as="pre"
              h="28"
              bg="bg.code"
              color="fg.muted"
              borderWidth="1px"
              borderColor="border.subtle"
              borderRadius="md"
              p="sm"
              textStyle="mono/XS"
            >
              {"$ rg --files design/motion/src/scenes\nchat.tsx\ntools-queue.tsx\npanels.tsx"}
            </Box>
          </Box>
        </Timeline.Content>
      </Timeline.Item>
    </Timeline.Root>
  );
};
