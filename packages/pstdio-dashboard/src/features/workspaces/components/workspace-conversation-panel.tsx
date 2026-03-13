import { Stack } from "@chakra-ui/react";
import { SessionChat } from "@/features/workspaces/components/session-chat";

interface WorkspaceConversationPanelProps {
  sessionId: string | null;
}

export const WorkspaceConversationPanel = (props: WorkspaceConversationPanelProps) => {
  const { sessionId } = props;

  return (
    <Stack
      h="full"
      flex="1"
      minW="0"
      minH="0"
      px="sm"
      pb="sm"
      align="flex-start"
      data-testid="workspace-conversation-panel"
    >
      <Stack flex="1" minH="0" w="full" maxW="52rem">
        <SessionChat sessionId={sessionId} />
      </Stack>
    </Stack>
  );
};
