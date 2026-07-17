import { Box, Flex } from "@chakra-ui/react";
import type { Frame, FrameSlot, WorkbenchCore } from "../../core";
import { WorkbenchArea } from "../area/area";
import { WorkbenchFocusRegion } from "../focus/focus-region";
import { getWorkbenchAreaBackground } from "../theme/workbench-theme-background";
import { FrameHeader } from "./frame-header";
import { resolveSlotChrome } from "./frame-slot-chrome";

interface FrameRegionProps {
  workbench: WorkbenchCore;
  frame: Frame;
  slot: FrameSlot;
  headerSlot?: FrameSlot;
  headerClaimed?: boolean;
}

export const FrameRegion = (props: FrameRegionProps) => {
  const { workbench, frame, slot, headerSlot, headerClaimed = false } = props;
  const chrome = resolveSlotChrome(slot.id);
  const header = headerClaimed ? null : (
    <FrameHeader workbench={workbench} frame={frame} targetSlot={slot} headerSlot={headerSlot} />
  );
  const area = (
    <Box flex="1" minH="0" minW="0" overflow="hidden">
      <WorkbenchArea workbench={workbench} area={slot.id} title={slot.id} />
    </Box>
  );
  const sharedProps = {
    as: chrome.as,
    bg: getWorkbenchAreaBackground(slot.id),
    display: "flex",
    flexDirection: "column",
    h: "full",
    minH: "0",
    minW: "0",
    overflow: "hidden",
    w: "full",
  } as const;

  if (chrome.focus?.scope === "region") {
    return (
      <WorkbenchFocusRegion workbench={workbench} area={chrome.focus.area} {...sharedProps}>
        {header}
        {area}
      </WorkbenchFocusRegion>
    );
  }

  if (chrome.focus?.scope === "content") {
    return (
      <Flex {...sharedProps}>
        {header}
        <WorkbenchFocusRegion
          workbench={workbench}
          area={chrome.focus.area}
          bg={getWorkbenchAreaBackground(slot.id)}
          flex="1"
          h="full"
          minH="0"
          minW="0"
          w="full"
          overflow="hidden"
        >
          <WorkbenchArea workbench={workbench} area={slot.id} title={slot.id} />
        </WorkbenchFocusRegion>
      </Flex>
    );
  }

  return (
    <Flex {...sharedProps}>
      {header}
      {area}
    </Flex>
  );
};
