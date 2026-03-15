import { HStack } from "@chakra-ui/react";
import { AgentBrowserContainer } from "@/features/agents/components/agent-browser.container";
import { SessionChatView } from "@/features/sessions/components/session-chat-view";
import { RepoBrowserContainer } from "./repo-browser.container";

interface SessionChatProps {
  sessionId: string | null;
  lockedBranch?: string | null;
}

export const SessionChat = (props: SessionChatProps) => {
  const { sessionId, lockedBranch } = props;

  return (
    <SessionChatView
      sessionId={sessionId}
      repoMenu={
        <HStack justify="space-between" align="center" wrap="wrap" w="full">
          <AgentBrowserContainer />
          <RepoBrowserContainer lockedBranch={lockedBranch ?? null} />
        </HStack>
      }
    />
  );
};
