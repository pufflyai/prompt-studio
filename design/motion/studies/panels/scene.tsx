import { Box, Flex, Stack, Text } from "@chakra-ui/react";
import { MousePointer2 } from "lucide-react";
import type { SceneProps } from "motion-lab/kit";
import {
  Composer,
  duration,
  FileRow,
  Message,
  PanelSurface,
  PanelTab,
  timings,
  track,
  WorkbenchFrame,
} from "motion-lab/kit";
export const Panels = (props: SceneProps) => {
  const { time } = props;
  const side = track(time, [
    { at: 1, value: 1, duration: duration(props, timings.panelOpen, true) },
    { at: 3, value: 0, duration: duration(props, timings.panelClose, true) },
    { at: 4, value: 1, duration: duration(props, timings.panelOpen, true) },
    { at: 4.09, value: 0, duration: duration(props, timings.panelClose, true) },
    { at: 5, value: 1, duration: duration(props, timings.panelOpen, true) },
  ]);
  const drag = time >= 7 && time < 8;
  const width = 420 + Math.max(0, Math.min(1, time - 7)) * 90;
  const terminal = track(time, [
    { at: 9, value: 1, duration: duration(props, timings.panelOpen, true) },
    { at: 11, value: 0, duration: duration(props, timings.panelClose, true) },
    { at: 12, value: 1, duration: duration(props, timings.panelOpen, true) },
    { at: 12.09, value: 0, duration: duration(props, timings.panelClose, true) },
  ]);
  return (
    <WorkbenchFrame
      side={
        side > 0 && (
          <Box w={`${side * (width + 4)}px`} pl="panel-gap" overflow="hidden" flexShrink="0" position="relative">
            <Box w={`${width}px`} h="full">
              <PanelSurface header={<PanelTab title="Review motion studies" chat />}>
                <Stack p="sm" flex="1" minH="0" overflow="hidden" gap="sm">
                  <Message user>Keep the lines stable while opening.</Message>
                  <Message>
                    The Side Panel keeps its content width during the reveal. The terminal stays beneath Main.
                  </Message>
                </Stack>
                <Composer />
              </PanelSurface>
            </Box>
            {drag && (
              <Box position="absolute" left="0" top="50%" color="fg">
                <MousePointer2 size={20} />
              </Box>
            )}
          </Box>
        )
      }
    >
      <Flex direction="column" h="full" minH="0">
        <Box flex="1" minH="0">
          <PanelSurface header={<PanelTab title="README.md" />}>
            <Flex flex="1" minH="0" overflow="hidden">
              <Stack
                w="150px"
                flexShrink="0"
                gap="0"
                borderRightWidth="1px"
                borderColor="border.subtle"
                bg="bg.subtle"
                p="compact"
              >
                <FileRow name="src" folder />
                <FileRow name="README.md" />
                <FileRow name="package.json" />
              </Stack>
              <Stack flex="1" minW="0" p="lg" gap="md" overflow="hidden">
                <Text textStyle="heading/M">Motion studies</Text>
                <Text textStyle="paragraph/S/regular">
                  Review chat and workbench motion using the shared UI components.
                </Text>
                <Text textStyle="label/S/medium">Examples</Text>
                <Text textStyle="paragraph/S/regular" color="fg.muted">
                  Chat turns, working styles, streaming text, tools, panels, menus, and tabs.
                </Text>
              </Stack>
            </Flex>
          </PanelSurface>
        </Box>
        <Box h={`${terminal * 244}px`} overflow="hidden" flexShrink="0">
          <Box pt="panel-gap" h="244px">
            <PanelSurface header={<PanelTab title="Terminal" />}>
              <Box flex="1" bg="bg.code" p="sm" fontFamily="mono" textStyle="label/S/regular">
                <Text>$ rg --files design/motion</Text>
                <Text color="fg.muted">src/scenes/chat.tsx</Text>
                <Text color="fg.muted">src/scenes/panels.tsx</Text>
                <Text>$ ▌</Text>
              </Box>
            </PanelSurface>
          </Box>
        </Box>
      </Flex>
    </WorkbenchFrame>
  );
};

export default Panels;
