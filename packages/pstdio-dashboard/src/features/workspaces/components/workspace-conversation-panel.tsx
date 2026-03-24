import { Stack } from "@chakra-ui/react";
import { SessionChatView } from "@/features/sessions/components/session-chat-view";

interface WorkspaceConversationPanelProps {
  sessionId: string | null;
  onEditAction?: () => void;
}

export const WorkspaceConversationPanel = (props: WorkspaceConversationPanelProps) => {
  const { sessionId, onEditAction } = props;

  return (
    <Stack h="full" flex="1" minW="0" minH="0" align="flex-start" data-testid="workspace-conversation-panel">
      <Stack flex="1" minH="0" w="full" maxW="52rem">
        <SessionChatView sessionId={sessionId} onEditAction={onEditAction} showWorkspaceHub={false} />
      </Stack>
    </Stack>
  );
};
