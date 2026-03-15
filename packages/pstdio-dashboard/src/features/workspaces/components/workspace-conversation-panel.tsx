import { Stack } from "@chakra-ui/react";
import { useSessionWorkspace } from "@/features/sessions/hooks/use-session-workspace";
import { SessionChat } from "@/features/workspaces/components/session-chat";

interface WorkspaceConversationPanelProps {
  sessionId: string | null;
}

export const WorkspaceConversationPanel = (props: WorkspaceConversationPanelProps) => {
  const { sessionId } = props;
  const workspace = useSessionWorkspace(sessionId);

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
        <SessionChat sessionId={sessionId} lockedBranch={workspace?.branch} />
      </Stack>
    </Stack>
  );
};
