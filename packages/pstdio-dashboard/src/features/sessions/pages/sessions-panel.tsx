import { Flex, HStack, IconButton, Stack, Text } from "@chakra-ui/react";
import { HorizontalMenuStack, Tooltip } from "@pstdio/ui";
import { useNavigate, useParams } from "@tanstack/react-router";
import { PenBox } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SessionActionMenu } from "../components/session-action-menu";
import { SessionChatView } from "../components/session-chat-view";
import { SessionsList } from "../components/sessions-list";
import { useArchiveSession } from "../hooks/use-archive-session";
import { useProjectSession } from "../hooks/use-project-session";
import { useProjectSessions } from "../hooks/use-project-sessions";
import { downloadSessionJson } from "../utils/session-download";

export const SessionsPanel = () => {
  const { t } = useTranslation("projects");
  const { projectId, sessionId } = useParams({ strict: false });
  const navigate = useNavigate();
  const selectedSessionId = typeof sessionId === "string" ? sessionId : null;

  const { data: sessions = [], isLoading } = useProjectSessions(projectId);
  const { data: selectedSessionDetails } = useProjectSession(projectId, selectedSessionId);
  const archiveSession = useArchiveSession();

  const selectedSession = sessions.find((s) => s.id === selectedSessionId) ?? null;
  const downloadableSession = selectedSessionDetails ?? selectedSession;

  const handleSelectSession = (nextSessionId: string) => {
    navigate({ to: `/projects/${projectId}/sessions/${nextSessionId}` });
  };

  const handleNewSession = () => {
    navigate({ to: `/projects/${projectId}/sessions` });
  };

  const handleArchive = () => {
    if (!selectedSessionId) return;
    archiveSession.mutate(selectedSessionId);
    navigate({ to: `/projects/${projectId}/sessions` });
  };

  return (
    <Flex direction="column" height="100%" minH="0">
      <Flex flex="1" minH="0" overflow="hidden">
        <Stack w="18rem" minW="18rem" borderRightWidth="1px" gap="0" bg="background.primary">
          <HorizontalMenuStack>
            <Text textStyle="label/S/medium" color="foreground.primary">
              {t("sessions.title")}
            </Text>

            <Tooltip content={t("sessions.newSession")}>
              <IconButton size="xs" variant="ghost" aria-label={t("sessions.newSession")} onClick={handleNewSession}>
                <PenBox size={16} />
              </IconButton>
            </Tooltip>
          </HorizontalMenuStack>

          <Stack flex="1" minH="0" overflowY="auto">
            <SessionsList
              sessions={sessions}
              selectedSessionId={selectedSessionId}
              isLoading={isLoading}
              onSelectSession={handleSelectSession}
            />
          </Stack>
        </Stack>

        <Stack flex="1" minW="0" minH="0" gap="0">
          <HorizontalMenuStack>
            <Text textStyle="label/S/medium" color="foreground.primary" lineClamp={1}>
              {selectedSession?.title ?? t("sessions.newSession")}
            </Text>

            <HStack gap="2xs">
              {downloadableSession ? (
                <SessionActionMenu
                  onDownloadSession={() => downloadSessionJson(downloadableSession)}
                  onArchiveSession={handleArchive}
                />
              ) : null}
            </HStack>
          </HorizontalMenuStack>

          <Stack flex="1" minH="0">
            <SessionChatView sessionId={selectedSessionId} />
          </Stack>
        </Stack>
      </Flex>
    </Flex>
  );
};
