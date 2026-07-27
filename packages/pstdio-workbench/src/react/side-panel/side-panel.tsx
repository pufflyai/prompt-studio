import { Box, Flex, IconButton, Text } from "@chakra-ui/react";
import { AttachedPanel, BubbleButton, BubblePanel, Header, PANEL_HEADER_CONTROL_SIZE, Tooltip } from "@pstdio/ui";
import { MessageCircle, Minimize2 } from "lucide-react";
import type { ReactNode } from "react";
import type { WorkbenchCore } from "../../core";
import { WorkbenchFocusRegion } from "../focus/focus-region";
import { WorkbenchPanelMenuLayout, WorkbenchPanelMenuOpeners } from "../panel-menu/panel-menu";
import { workbenchBackgrounds } from "../theme/workbench-theme-background";

interface WorkbenchSidePanelProps {
  workbench: WorkbenchCore;
  contentSlotRef: (node: HTMLDivElement | null) => void;
  bottomOffset?: string;
  header?: ReactNode;
}

const floatingPanelBottom = (bottomOffset: string | undefined) =>
  bottomOffset ? `calc(${bottomOffset} + 0.75rem)` : "3";

const launcherBottom = (bottomOffset: string | undefined) => (bottomOffset ? `calc(${bottomOffset} + 1.5rem)` : "6");

const WorkbenchSidePanelTitle = () => (
  <Box flex="1" minW="0">
    <Text textStyle="label/S/medium" color="fg" truncate>
      Side Panel
    </Text>
  </Box>
);

interface WorkbenchSidePanelHeaderProps {
  header?: ReactNode;
}

const WorkbenchSidePanelHeader = (props: WorkbenchSidePanelHeaderProps) => {
  const { header } = props;

  return header ?? <WorkbenchSidePanelTitle />;
};

export const WorkbenchAttachedSidePanel = (props: WorkbenchSidePanelProps) => {
  const { workbench, contentSlotRef, header } = props;

  return (
    <WorkbenchFocusRegion workbench={workbench} region="side" h="full" minH="0" minW="0" w="full">
      <AttachedPanel
        data-testid="workbench-side-panel-attached"
        data-workbench-panel="side"
        data-workbench-region="side"
        width="full"
        minWidth="0"
        bg={workbenchBackgrounds.widget}
        header={
          <Header data-workbench-panel-header="side" variant="main" flexShrink={0} gap="sm">
            <WorkbenchSidePanelHeader header={header} />
            <WorkbenchPanelMenuOpeners workbench={workbench} panel="side" />
            <Tooltip content="Float Side Panel">
              <IconButton
                size={PANEL_HEADER_CONTROL_SIZE}
                variant="ghost"
                aria-label="Float Side Panel"
                onClick={() => workbench.sidePanel.setMode("floating")}
              >
                <Minimize2 size={16} />
              </IconButton>
            </Tooltip>
          </Header>
        }
      >
        <WorkbenchPanelMenuLayout workbench={workbench} panel="side">
          <Flex ref={contentSlotRef} flex="1" minH={0} direction="column" />
        </WorkbenchPanelMenuLayout>
      </AttachedPanel>
    </WorkbenchFocusRegion>
  );
};

export const WorkbenchFloatingSidePanel = (props: WorkbenchSidePanelProps) => {
  const { workbench, contentSlotRef, bottomOffset, header } = props;
  const mode = workbench.sidePanel.getMode();

  if (mode === "attached") return null;

  if (mode === "closed") {
    return (
      <BubbleButton
        aria-label="Open Side Panel"
        containerProps={{ bottom: launcherBottom(bottomOffset) }}
        tooltip="Open Side Panel"
        onClick={() => workbench.sidePanel.setMode("floating")}
      >
        <MessageCircle size={20} strokeWidth={2} />
      </BubbleButton>
    );
  }

  return (
    <BubblePanel
      isOpen
      aria-label="Side Panel"
      testId="workbench-side-panel-floating"
      closeLabel="Close Side Panel"
      containerProps={{ bottom: floatingPanelBottom(bottomOffset), bg: workbenchBackgrounds.widget }}
      popOutLabel="Reattach Side Panel"
      onClose={() => workbench.sidePanel.setMode("closed")}
      onPopOut={() => workbench.sidePanel.setMode("attached")}
      menu={<WorkbenchSidePanelHeader header={header} />}
    >
      <Flex ref={contentSlotRef} flex="1" minH={0} direction="column" />
    </BubblePanel>
  );
};
