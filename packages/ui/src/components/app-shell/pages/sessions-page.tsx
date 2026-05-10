import { Box, HStack, IconButton, Spacer, Stack, Text } from "@chakra-ui/react";
import { Plus } from "lucide-react";

import { ChatPanel } from "../../chat-ui/components/chat-panel";
import { Header } from "../../header";
import { ListRow } from "../../list-row/list-row";
import { ResizableSplitLayout } from "../../resizable-split-layout";
import {
  resolveSessionIndicatorColor,
  resolveSessionIndicatorIcon,
  type SessionCompletionStatus,
} from "../../session-indicator";
import { mockChatMessages } from "../mock-chat";
import { mockSessions } from "../mock-data";

interface SessionsPageProps {
  selectedSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
}

const renderSessionIcon = (status: SessionCompletionStatus) => {
  const Icon = resolveSessionIndicatorIcon(status);
  return <Icon size={14} />;
};

const SessionsList = (props: { selectedId: string | null; onSelect: (id: string) => void }) => (
  <Stack flex="1" minH="0" bg="bg" borderRightWidth="1px" borderColor="border.muted" gap="0">
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
  </Stack>
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
      <ResizableSplitLayout
        flex="1"
        minH="0"
        minW="0"
        resizablePanel={<SessionsList selectedId={selectedSessionId} onSelect={onSelectSession} />}
        contentPanel={
          selectedSession ? (
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
          )
        }
        defaultSizePx={280}
        minSizePx={220}
        maxSizePx={420}
        contentMinSizePx={320}
        collapsible={false}
        resizeLabel="Resize sessions list"
        showResizeSeparator={false}
      />
    </HStack>
  );
};
