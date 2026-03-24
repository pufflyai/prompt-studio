import { Flex, HStack, IconButton, Stack, Text } from "@chakra-ui/react";
import { HorizontalMenuStack, Tooltip } from "@pstdio/ui";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { PenBox, SquareArrowOutDownRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { BackToDashboard } from "@/features/project/components/back-to-dashboard";
import { useProjectSettingsStore } from "@/features/project-settings/store";
import { SessionActionMenu } from "../components/session-action-menu";
import { SessionChatView } from "../components/session-chat-view";
import { SessionsList } from "../components/sessions-list";
import { useArchiveSession } from "../hooks/use-archive-session";
import { useProjectSession } from "../hooks/use-project-session";
import { useProjectSessions } from "../hooks/use-project-sessions";
import { downloadSessionJson } from "../utils/session-download";
import { getSessionBubbleReturnPath } from "../utils/sessions-route";
import { getVisibleSessions } from "../utils/visible-sessions";
import { openSessionBubbleAndGoBack } from "./sessions-panel-actions";

export const SessionsPanel = () => {
  const { t } = useTranslation("projects");
  const { projectId, sessionId } = useParams({ strict: false });
  const navigate = useNavigate();
  const setSessionModalState = useProjectSettingsStore((state) => state.setSessionModalState);
  const setSelectedSessionId = useProjectSettingsStore((state) => state.setSelectedSessionId);
  const lastNonSessionsPath = useProjectSettingsStore((state) => state.lastNonSessionsPath);
  const selectedSessionId = typeof sessionId === "string" ? sessionId : null;

  const { data: sessions = [], isLoading } = useProjectSessions(projectId);
  const visibleSessions = getVisibleSessions(sessions);
  const { data: selectedSessionDetails } = useProjectSession(projectId, selectedSessionId);
  const archiveSession = useArchiveSession();

  const selectedSession = visibleSessions.find((s) => s.id === selectedSessionId) ?? null;
  const downloadableSession = selectedSessionDetails ?? selectedSession;

  const handleSelectSession = (nextSessionId: string) => {
    navigate({ to: `/projects/${projectId}/sessions/${nextSessionId}` });
  };

  const handleOpenInBubble = () => {
    openSessionBubbleAndGoBack({
      sessionId: selectedSessionId,
      setSessionModalState,
      setSelectedSessionId,
      navigateBack: () => {
        const returnPath = getSessionBubbleReturnPath({ projectId, lastNonSessionsPath });
        navigate({ to: returnPath });
      },
    });
  };

  const handleArchive = () => {
    if (!selectedSessionId) return;
    archiveSession.mutate(selectedSessionId);
    navigate({ to: `/projects/${projectId}/sessions` });
  };

  return (
    <Flex direction="column" height="100%" minH="0">
      <Flex flex="1" minH="0" overflow="hidden">
        <Stack w="18rem" minW="18rem" borderRightWidth="1px" gap="0" bg="bg">
          <BackToDashboard />
          <HorizontalMenuStack>
            <Text textStyle="label/S/medium" color="foreground.primary">
              {t("sessions.title")}
            </Text>

            <Tooltip content={t("sessions.newSession")}>
              <IconButton size="xs" variant="ghost" aria-label={t("sessions.newSession")} asChild>
                <Link to={`/projects/${projectId}/sessions`}>
                  <PenBox size={16} />
                </Link>
              </IconButton>
            </Tooltip>
          </HorizontalMenuStack>

          <Stack flex="1" minH="0" overflowY="auto">
            <SessionsList
              sessions={visibleSessions}
              selectedSessionId={selectedSessionId}
              isLoading={isLoading}
              projectId={projectId}
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
              <Tooltip content={t("chatInput.session.openInBubble")}>
                <IconButton
                  size="xs"
                  variant="ghost"
                  aria-label={t("chatInput.session.openInBubble")}
                  onClick={handleOpenInBubble}
                >
                  <SquareArrowOutDownRight size={16} />
                </IconButton>
              </Tooltip>
              {downloadableSession ? (
                <SessionActionMenu
                  agentSessionId={downloadableSession.agentSessionId}
                  onDownloadSession={() => {
                    void downloadSessionJson(downloadableSession);
                  }}
                  onArchiveSession={handleArchive}
                />
              ) : null}
            </HStack>
          </HorizontalMenuStack>

          <Stack flex="1" minH="0" px="sm" pb="sm" align="flex-start">
            <Stack flex="1" minH="0" w="full" maxW="52rem">
              <SessionChatView sessionId={selectedSessionId} onSessionCreated={handleSelectSession} />
            </Stack>
          </Stack>
        </Stack>
      </Flex>
    </Flex>
  );
};
