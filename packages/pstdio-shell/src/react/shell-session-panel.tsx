import { Box, Flex, IconButton, Spacer, Text } from "@chakra-ui/react";
import { AttachedPanel, BubbleButton, BubblePanel, Header, Tooltip } from "@pstdio/ui";
import { MessageCircle, Minimize2 } from "lucide-react";
import { useShellSessionPanelStore } from "./shell-session-panel-store";

interface ShellSessionPanelProps {
  contentSlotRef: (node: HTMLDivElement | null) => void;
}

export const ShellSessionAttachedPanel = (props: ShellSessionPanelProps) => {
  const { contentSlotRef } = props;
  const setMode = useShellSessionPanelStore((state) => state.setMode);

  return (
    <AttachedPanel
      data-testid="shell-session-attached-panel"
      width="full"
      minWidth="0"
      header={
        <Header variant="main" flexShrink={0}>
          <Text textStyle="label/S/medium" color="fg" truncate>
            Session
          </Text>
          <Spacer />
          <Tooltip content="Detach panel">
            <IconButton size="xs" variant="ghost" aria-label="Detach panel" onClick={() => setMode("bubble")}>
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

export const ShellSessionBubbleContainer = (props: ShellSessionPanelProps) => {
  const { contentSlotRef } = props;
  const mode = useShellSessionPanelStore((state) => state.mode);
  const setMode = useShellSessionPanelStore((state) => state.setMode);

  if (mode === "attached") {
    return null;
  }

  if (mode === "closed") {
    return (
      <BubbleButton aria-label="Open session panel" tooltip="Open session panel" onClick={() => setMode("bubble")}>
        <MessageCircle size={20} strokeWidth={2} />
      </BubbleButton>
    );
  }

  return (
    <BubblePanel
      isOpen
      aria-label="Session"
      testId="shell-session-bubble"
      closeLabel="Minimize panel"
      popOutLabel="Attach panel"
      onClose={() => setMode("closed")}
      onPopOut={() => setMode("attached")}
      menu={
        <Box minW="0">
          <Text textStyle="label/S/medium" color="fg" truncate>
            Session
          </Text>
        </Box>
      }
    >
      <Flex ref={contentSlotRef} flex="1" minH={0} direction="column" />
    </BubblePanel>
  );
};
