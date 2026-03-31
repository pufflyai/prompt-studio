import { Flex, HStack, Stack, Text } from "@chakra-ui/react";
import { AlertTriangle } from "lucide-react";
import { SessionChatView } from "@/features/sessions/components/session-chat-view";

interface WorkspaceConversationPanelProps {
  sessionId: string | null;
  workspaceId?: string;
  setupError?: string | null;
  onEditAction?: () => void;
  onSessionCreated?: (sessionId: string) => void;
}

export const WorkspaceConversationPanel = (props: WorkspaceConversationPanelProps) => {
  const { sessionId, workspaceId, setupError, onEditAction, onSessionCreated } = props;

  return (
    <Stack h="full" flex="1" minW="0" minH="0" align="flex-start" data-testid="workspace-conversation-panel">
      {setupError ? (
        <Flex
          w="full"
          maxW="52rem"
          px="sm"
          py="xs"
          borderWidth="1px"
          borderColor="border.error"
          borderRadius="xs"
          bg="bg.error"
        >
          <HStack gap="xs" minW="0">
            <AlertTriangle size={14} color="var(--chakra-colors-fg-error)" />
            <Text textStyle="label/S/regular" color="fg.error" truncate>
              Workspace setup failed: {setupError}
            </Text>
          </HStack>
        </Flex>
      ) : null}

      <Stack flex="1" minH="0" w="full" maxW="52rem">
        <SessionChatView
          sessionId={sessionId}
          workspaceId={workspaceId}
          onEditAction={onEditAction}
          onSessionCreated={onSessionCreated}
          showWorkspaceHub={false}
        />
      </Stack>
    </Stack>
  );
};
