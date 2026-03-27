import { Flex, HStack, IconButton, Spacer } from "@chakra-ui/react";
import { Tooltip } from "@pstdio/ui";
import { useParams } from "@tanstack/react-router";
import { Minimize2, PenBox } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useProjectSettingsStore } from "@/features/project-settings/store";
import { useProjectSessions } from "../hooks/use-project-sessions";
import { SessionChatView } from "./session-chat-view";
import { SessionSelector } from "./session-selector";

export const SessionAttachedPanel = () => {
  const { t } = useTranslation("projects");
  const { projectId } = useParams({ strict: false });
  const setSessionModalState = useProjectSettingsStore((s) => s.setSessionModalState);
  const selectedSessionId = useProjectSettingsStore((s) => s.selectedSessionId);
  const setSelectedSessionId = useProjectSettingsStore((s) => s.setSelectedSessionId);

  const { data: sessions = [] } = useProjectSessions(projectId);

  return (
    <Flex
      data-testid="session-attached-panel"
      direction="column"
      w="28rem"
      minW="28rem"
      h="100%"
      borderLeftWidth="1px"
      bg="bg"
    >
      <HStack px="sm" pt="sm" pb="xs">
        <SessionSelector
          sessions={sessions}
          selectedSessionId={selectedSessionId}
          onSelectSession={setSelectedSessionId}
        />
        <Tooltip content={t("sessions.newSession")}>
          <IconButton
            size="xs"
            variant="ghost"
            aria-label={t("sessions.newSession")}
            onClick={() => setSelectedSessionId(null)}
          >
            <PenBox size={16} />
          </IconButton>
        </Tooltip>
        <Spacer />
        <Tooltip content="Detach panel">
          <IconButton
            size="xs"
            variant="ghost"
            aria-label="Detach panel"
            onClick={() => setSessionModalState("bubble")}
          >
            <Minimize2 size={16} />
          </IconButton>
        </Tooltip>
      </HStack>
      <Flex flex="1" minH={0} direction="column">
        <SessionChatView sessionId={selectedSessionId} onSessionCreated={setSelectedSessionId} />
      </Flex>
    </Flex>
  );
};
