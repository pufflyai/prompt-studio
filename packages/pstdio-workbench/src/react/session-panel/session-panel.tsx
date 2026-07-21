import { Box, Flex, IconButton, Text } from "@chakra-ui/react";
import { AttachedPanel, BubbleButton, BubblePanel, Header, PANEL_HEADER_CONTROL_SIZE, Tooltip } from "@pstdio/ui";
import { MessageCircle, Minimize2 } from "lucide-react";
import type { ReactNode } from "react";
import type { WorkbenchCore } from "../../core";
import { WorkbenchFocusRegion } from "../focus/focus-region";
import { WorkbenchPanelMenuLayout, WorkbenchPanelMenuOpeners } from "../panel-menu/panel-menu";
import { workbenchBackgrounds } from "../theme/workbench-theme-background";

interface WorkbenchSessionPanelProps {
  workbench: WorkbenchCore;
  contentSlotRef: (node: HTMLDivElement | null) => void;
  bottomOffset?: string;
  header?: ReactNode;
}

const bubblePanelBottom = (bottomOffset: string | undefined) =>
  bottomOffset ? `calc(${bottomOffset} + 0.75rem)` : "3";

const bubbleButtonBottom = (bottomOffset: string | undefined) =>
  bottomOffset ? `calc(${bottomOffset} + 1.5rem)` : "6";

const WorkbenchSessionTitle = () => (
  <Box flex="1" minW="0">
    <Text textStyle="label/S/medium" color="fg" truncate>
      Session
    </Text>
  </Box>
);

interface WorkbenchSessionHeaderProps {
  header?: ReactNode;
}

const WorkbenchSessionHeader = (props: WorkbenchSessionHeaderProps) => {
  const { header } = props;

  return header ?? <WorkbenchSessionTitle />;
};

export const WorkbenchSessionAttachedPanel = (props: WorkbenchSessionPanelProps) => {
  const { workbench, contentSlotRef, header } = props;

  return (
    <WorkbenchFocusRegion workbench={workbench} region="side" h="full" minH="0" minW="0" w="full">
      <AttachedPanel
        data-testid="workbench-session-attached-panel"
        data-workbench-panel="side"
        data-workbench-region="side"
        width="full"
        minWidth="0"
        bg={workbenchBackgrounds.widget}
        header={
          <Header data-workbench-panel-header="side" variant="main" flexShrink={0} gap="sm">
            <WorkbenchSessionHeader header={header} />
            <WorkbenchPanelMenuOpeners workbench={workbench} panel="side" />
            <Tooltip content="Detach panel">
              <IconButton
                size={PANEL_HEADER_CONTROL_SIZE}
                variant="ghost"
                aria-label="Detach panel"
                onClick={() => workbench.sessionPanel.setMode("bubble")}
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

export const WorkbenchSessionBubbleContainer = (props: WorkbenchSessionPanelProps) => {
  const { workbench, contentSlotRef, bottomOffset, header } = props;
  const mode = workbench.sessionPanel.getMode();

  if (mode === "attached") return null;

  if (mode === "closed") {
    return (
      <BubbleButton
        aria-label="Open session panel"
        containerProps={{ bottom: bubbleButtonBottom(bottomOffset) }}
        tooltip="Open session panel"
        onClick={() => workbench.sessionPanel.setMode("bubble")}
      >
        <MessageCircle size={20} strokeWidth={2} />
      </BubbleButton>
    );
  }

  return (
    <BubblePanel
      isOpen
      aria-label="Session"
      testId="workbench-session-bubble"
      closeLabel="Minimize panel"
      containerProps={{ bottom: bubblePanelBottom(bottomOffset), bg: workbenchBackgrounds.widget }}
      popOutLabel="Attach panel"
      onClose={() => workbench.sessionPanel.setMode("closed")}
      onPopOut={() => workbench.sessionPanel.setMode("attached")}
      menu={<WorkbenchSessionHeader header={header} />}
    >
      <Flex ref={contentSlotRef} flex="1" minH={0} direction="column" />
    </BubblePanel>
  );
};
