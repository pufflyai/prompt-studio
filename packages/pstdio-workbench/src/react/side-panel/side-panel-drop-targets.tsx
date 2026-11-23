import { Box, Flex } from "@chakra-ui/react";
import { floatingPanelGeometry, Portal } from "@pstdio/ui";
import { sidePanelAlignments } from "./use-side-panel-position";

interface SidePanelDropTargetsProps {
  alignment?: (typeof sidePanelAlignments)[number];
  bottom: string;
  surface?: "bubble" | "panel";
}

export const SidePanelDropTargets = (props: SidePanelDropTargetsProps) => {
  const { alignment, bottom, surface = "panel" } = props;
  if (!alignment) return null;
  const inset = surface === "bubble" ? "6" : `${floatingPanelGeometry.inset}px`;
  return (
    <Portal>
      <Flex
        aria-hidden
        position="fixed"
        left={inset}
        right={inset}
        bottom={bottom}
        justify="space-between"
        zIndex="overlay"
        pointerEvents="none"
      >
        {sidePanelAlignments.map((slot) => (
          <Box
            key={slot}
            data-side-panel-drop-slot={slot}
            data-drop-surface={surface}
            data-drop-active={slot === alignment || undefined}
            layerStyle="panelSnapIndicator"
          />
        ))}
      </Flex>
    </Portal>
  );
};
