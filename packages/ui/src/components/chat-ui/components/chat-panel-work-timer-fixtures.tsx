import { Box, Button } from "@chakra-ui/react";
import { useState } from "react";
import { ChatPanel, type ChatPanelProps } from "./chat-panel";

export const WorkingIndicatorVisibilityRenderer = (props: ChatPanelProps) => {
  const { messages, emptyStateTitle, emptyStateDescription, chatInputPlaceholder, actions, streamingStartedAt } = props;
  const [startedAt] = useState(() => streamingStartedAt ?? Date.now());
  const [workspaceInitializing, setWorkspaceInitializing] = useState(false);
  const [reopenCount, setReopenCount] = useState(0);

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setWorkspaceInitializing((current) => !current)}>
        {workspaceInitializing ? "Show working indicator" : "Hide working indicator"}
      </Button>
      <Button size="sm" variant="outline" onClick={() => setReopenCount((current) => current + 1)}>
        Reopen conversation
      </Button>
      <Box flex="1" minH="0">
        <ChatPanel
          key={reopenCount}
          messages={messages}
          streaming
          streamingStartedAt={startedAt}
          workspaceInitializing={workspaceInitializing}
          emptyStateTitle={emptyStateTitle}
          emptyStateDescription={emptyStateDescription}
          chatInputPlaceholder={chatInputPlaceholder}
          actions={actions}
        />
      </Box>
    </>
  );
};
