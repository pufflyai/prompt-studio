import { Box, HStack, IconButton, Spacer, Stack, Text } from "@chakra-ui/react";
import { Plus } from "lucide-react";

import { ChatPanel } from "../../chat-ui/components/chat-panel";
import { Header } from "../../header";
import { ListRow } from "../../list-row/list-row";
import {
  resolveSessionIndicatorColor,
  resolveSessionIndicatorIcon,
  type SessionCompletionStatus,
} from "../../session-indicator";
import { mockChatMessages } from "../mock-chat";
import { mockSessions } from "../mock-data";
import { ResizablePanel } from "../resizable-panel";

interface SessionsPageProps {
  selectedSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
}

const renderSessionIcon = (status: SessionCompletionStatus) => {
  const Icon = resolveSessionIndicatorIcon(status);
  return <Icon size={14} />;
};

const SessionsList = (props: { selectedId: string | null; onSelect: (id: string) => void }) => (
  <ResizablePanel
    defaultWidth={280}
    minWidth={220}
    maxWidth={420}
    handleSide="right"
    ariaLabel="Resize sessions list"
    borderRightWidth="1px"
    borderColor="border.muted"
    bg="bg"
  >
    <Header variant="narrow" borderBottomWidth="1px" borderColor="border.muted" bg="bg">
      <Text textStyle="label/S/medium">Sessions</Text>
      <Spacer />
      <IconButton size="xs" variant="ghost" aria-label="New session">
        <Plus size={14} />
      </IconButton>
    </Header>

    <Stack flex="1" minH="0" overflowY="auto" gap="0">
      {mockSessions.map((session) => (
        <ListRow
          key={session.id}
          variant="compact"
          isSelected={session.id === props.selectedId}
          id={session.id}
          label={session.title}
          description={session.preview}
          icon={renderSessionIcon(session.status)}
          iconColor={resolveSessionIndicatorColor(session.status)}
          onActivate={() => props.onSelect(session.id)}
        />
      ))}
    </Stack>
  </ResizablePanel>
);

const SessionEmpty = () => (
  <Stack flex="1" minW="0" align="center" justify="center" p="lg">
    <Text textStyle="paragraph/S/regular" color="fg.muted">
      Select a session to view its transcript.
    </Text>
  </Stack>
);

export const SessionsPage = (props: SessionsPageProps) => {
  const { selectedSessionId, onSelectSession } = props;
  const selectedSession = mockSessions.find((session) => session.id === selectedSessionId) ?? null;

  return (
    <HStack flex="1" minH="0" gap="0" align="stretch">
      <SessionsList selectedId={selectedSessionId} onSelect={onSelectSession} />
      {selectedSession ? (
        <Box flex="1" minW="0" minH="0">
          <ChatPanel
            messages={mockChatMessages}
            emptyStateTitle="No messages yet"
            emptyStateDescription="Start the conversation."
            chatInputPlaceholder="Reply to the agent…"
          />
        </Box>
      ) : (
        <SessionEmpty />
      )}
    </HStack>
  );
};
