import { Box, Flex } from "@chakra-ui/react";
import { Portal } from "@pstdio/ui";
import { sidePanelAlignments } from "./use-side-panel-position";

interface SidePanelDropTargetsProps {
  alignment?: (typeof sidePanelAlignments)[number];
  bottom?: string;
}

export const SidePanelDropTargets = (props: SidePanelDropTargetsProps) => {
  const { alignment, bottom = "0" } = props;
  if (!alignment) return null;
  return (
    <Portal>
      <Flex
        aria-hidden
        position="fixed"
        left="0"
        right="0"
        bottom={bottom}
        h="12"
        zIndex="overlay"
        pointerEvents="none"
      >
        {sidePanelAlignments.map((slot) => (
          <Box
            key={slot}
            data-side-panel-drop-slot={slot}
            data-drop-active={slot === alignment || undefined}
            position="relative"
            flex="1"
            minW="0"
            layerStyle="panelDropZone"
          />
        ))}
      </Flex>
    </Portal>
  );
};
