import { Box, Flex } from "@chakra-ui/react";
import type { Frame, FrameSlot, WorkbenchCore } from "../../core";
import { WorkbenchArea } from "../area/area";
import { WorkbenchFocusRegion } from "../focus/focus-region";
import { getWorkbenchAreaBackground } from "../theme/workbench-theme-background";
import { PanelMenuHost } from "../workbench/panel-menu-host";
import { WorkbenchActivityBar, WorkbenchHeader, WorkbenchStatusBar } from "../workbench/workbench-panels";
import { WorkbenchSidePanel } from "../workbench/workbench-side-panel";
import { FrameHeader } from "./frame-header";
import { resolveSlotChrome } from "./frame-slot-chrome";

interface WorkbenchFrameSlotProps {
  workbench: WorkbenchCore;
  frame: Frame;
  slot: FrameSlot;
}

export const WorkbenchFrameSlot = (props: WorkbenchFrameSlotProps) => {
  const { workbench, frame, slot } = props;
  const chrome = resolveSlotChrome(slot.id);
  if (chrome.renderer === "activity") return <WorkbenchActivityBar workbench={workbench} />;
  if (chrome.renderer === "nav") return <WorkbenchHeader workbench={workbench} />;
  if (chrome.renderer === "side") return <WorkbenchSidePanel workbench={workbench} presentation="docked" />;
  if (chrome.renderer === "status") return <WorkbenchStatusBar workbench={workbench} />;

  const header = slot.regions?.header ? <FrameHeader workbench={workbench} frame={frame} targetSlot={slot} /> : null;
  const area = (
    <PanelMenuHost workbench={workbench} area={slot.id}>
      <Box flex="1" h="full" minH="0" minW="0" overflow="hidden">
        <WorkbenchArea workbench={workbench} area={slot.id} title={slot.id} />
      </Box>
    </PanelMenuHost>
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
          {area}
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
