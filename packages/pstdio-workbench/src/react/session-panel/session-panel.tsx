import { Box, Flex, IconButton, Text } from "@chakra-ui/react";
import { AttachedPanel, BubbleButton, BubblePanel, Header, Tooltip } from "@pstdio/ui";
import { MessageCircle, Minimize2 } from "lucide-react";
import type { ReactNode } from "react";
import type { WorkbenchCore } from "../../core";
import { workbenchBackgrounds } from "../theme/workbench-theme-background";

interface WorkbenchSessionPanelProps {
  workbench: WorkbenchCore;
  contentSlotRef: (node: HTMLDivElement | null) => void;
  header?: ReactNode;
}

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
    <AttachedPanel
      data-testid="workbench-session-attached-panel"
      width="full"
      minWidth="0"
      header={
        <Header variant="main" bg={workbenchBackgrounds.panel} flexShrink={0} gap="sm">
          <WorkbenchSessionHeader header={header} />
          <Tooltip content="Detach panel">
            <IconButton
              size="xs"
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
      <Flex ref={contentSlotRef} flex="1" minH={0} direction="column" />
    </AttachedPanel>
  );
};

export const WorkbenchSessionBubbleContainer = (props: WorkbenchSessionPanelProps) => {
  const { workbench, contentSlotRef, header } = props;
  const mode = workbench.sessionPanel.getMode();

  if (mode === "attached") return null;

  if (mode === "closed") {
    return (
      <BubbleButton
        aria-label="Open session panel"
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
      popOutLabel="Attach panel"
      onClose={() => workbench.sessionPanel.setMode("closed")}
      onPopOut={() => workbench.sessionPanel.setMode("attached")}
      menu={<WorkbenchSessionHeader header={header} />}
    >
      <Flex ref={contentSlotRef} flex="1" minH={0} direction="column" />
    </BubblePanel>
  );
};
