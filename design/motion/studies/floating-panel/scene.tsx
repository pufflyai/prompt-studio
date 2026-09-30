import { Box, Flex, HStack, IconButton, Spacer, Stack, Text } from "@chakra-ui/react";
import { BubbleButton, Header, PANEL_HEADER_CONTROL_SIZE } from "@pstdio/ui";
import { MessageCircle, Minus, SquareArrowOutUpRight } from "lucide-react";
import type { SceneProps } from "motion-lab/kit";
import { Composer, duration, Message, PanelSurface, PanelTab, timings, track, WorkbenchFrame } from "motion-lab/kit";

const toggles = [
  { at: 1, open: true },
  { at: 3, open: false },
  { at: 4, open: true },
  { at: 4.09, open: false },
  { at: 5, open: true },
  { at: 7, open: false },
];

export const FloatingPanel = (props: SceneProps) => {
  const { time, reducedMotion } = props;
  const panel = track(
    time,
    toggles.map(({ at, open }) => ({
      at,
      value: open ? 1 : 0,
      duration: duration(props, open ? timings.panelOpen : timings.panelClose),
    })),
  );
  const launcher = track(
    time,
    toggles.map(({ at, open }) => ({
      at,
      value: open ? 0 : 1,
      duration: duration(props, open ? timings.surfaceExit : timings.surfaceEnter),
    })),
    1,
  );
  // Opacity stays under reduced motion; only the growth out of the launcher corner is removed.
  const growth = reducedMotion ? 1 : panel;
  const launcherGrowth = reducedMotion ? 1 : launcher;
  return (
    <Box position="relative" h="full">
      <WorkbenchFrame>
        <PanelSurface header={<PanelTab title="README.md" />}>
          <Stack flex="1" minW="0" p="lg" gap="md" overflow="hidden">
            <Text textStyle="heading/M">Motion studies</Text>
            <Text textStyle="paragraph/S/regular">
              The floating Side Panel opens from its launcher and returns to it when minimized.
            </Text>
          </Stack>
        </PanelSurface>
      </WorkbenchFrame>
      {launcher > 0 && (
        <BubbleButton
          aria-label="Open Side Panel"
          containerProps={{
            position: "absolute",
            bottom: "calc(2rem + 1.5rem)",
            opacity: launcher,
            transform: `scale(${0.9 + 0.1 * launcherGrowth})`,
          }}
        >
          <MessageCircle size={20} strokeWidth={2} />
        </BubbleButton>
      )}
      {panel > 0 && (
        // Mirrors BubblePanel, which portals to the document body and would escape the scene.
        <Flex
          direction="column"
          position="absolute"
          bottom="calc(2rem + 0.75rem)"
          right="3"
          w="28rem"
          h="38rem"
          borderRadius="xs"
          borderWidth="1px"
          borderColor="border.subtle"
          bg="bg.panel"
          overflow="hidden"
          zIndex="dropdown"
          opacity={panel}
          transformOrigin="bottom right"
          transform={`translateY(${8 * (1 - growth)}px) scale(${0.96 + 0.04 * growth})`}
        >
          <Header variant="main" gap="sm" flexShrink={0}>
            <HStack gap="1" minW="0">
              <PanelTab title="Review motion studies" chat />
            </HStack>
            <Spacer />
            <HStack gap="1">
              <IconButton size={PANEL_HEADER_CONTROL_SIZE} variant="ghost" aria-label="Reattach Side Panel">
                <SquareArrowOutUpRight size={16} />
              </IconButton>
              <IconButton size={PANEL_HEADER_CONTROL_SIZE} variant="ghost" aria-label="Close Side Panel">
                <Minus size={16} />
              </IconButton>
            </HStack>
          </Header>
          <Stack p="sm" flex="1" minH="0" overflow="hidden" gap="sm">
            <Message user>Open the panel from the launcher.</Message>
            <Message>The panel keeps its size while it fades in, so the text never reflows.</Message>
          </Stack>
          <Composer />
        </Flex>
      )}
    </Box>
  );
};

export default FloatingPanel;
