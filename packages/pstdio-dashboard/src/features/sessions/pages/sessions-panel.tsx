import { Flex, HStack, IconButton, Stack, Text } from "@chakra-ui/react";
import { HorizontalMenuStack, Tooltip } from "@pstdio/ui";
import { useNavigate, useParams } from "@tanstack/react-router";
import { ArrowLeft, PenBox } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AgentBrowserContainer } from "@/features/agents/components/agent-browser.container";
import { useProjectSettingsStore } from "@/features/project-settings/store";
import { RepoBrowserContainer } from "@/features/workspaces/components/repo-browser.container";
import { SessionActionMenu } from "../components/session-action-menu";
import { SessionChatView } from "../components/session-chat-view";
import { SessionsList } from "../components/sessions-list";
import { useArchiveSession } from "../hooks/use-archive-session";
import { useCreateProjectSession } from "../hooks/use-create-project-session";
import { useProjectSession } from "../hooks/use-project-session";
import { useProjectSessions } from "../hooks/use-project-sessions";
import { useSessionWorkspace } from "../hooks/use-session-workspace";
import { downloadSessionJson } from "../utils/session-download";
import { getVisibleSessions } from "../utils/visible-sessions";
import { createSessionFromPrompt, openSessionBubbleAndGoBack } from "./sessions-panel-actions";

export const SessionsPanel = () => {
  const { t } = useTranslation("projects");
  const { projectId, sessionId } = useParams({ strict: false });
  const navigate = useNavigate();
  const setSessionModalState = useProjectSettingsStore((state) => state.setSessionModalState);
  const setSelectedSessionId = useProjectSettingsStore((state) => state.setSelectedSessionId);
  const lastSelectedAgent = useProjectSettingsStore((state) => state.lastSelectedAgent);
  const lastSelectedModels = useProjectSettingsStore((state) => state.lastSelectedModels);
  const selectedSessionId = typeof sessionId === "string" ? sessionId : null;
  const createSession = useCreateProjectSession();
  const model = lastSelectedModels[0] ?? undefined;

  const { data: sessions = [], isLoading } = useProjectSessions(projectId);
  const visibleSessions = getVisibleSessions(sessions);
  const { data: selectedSessionDetails } = useProjectSession(projectId, selectedSessionId);
  const workspace = useSessionWorkspace(selectedSessionId);
  const archiveSession = useArchiveSession();

  const selectedSession = visibleSessions.find((s) => s.id === selectedSessionId) ?? null;
  const downloadableSession = selectedSessionDetails ?? selectedSession;

  const handleSelectSession = (nextSessionId: string) => {
    navigate({ to: `/projects/${projectId}/sessions/${nextSessionId}` });
  };

  const handleNewSession = () => {
    navigate({ to: `/projects/${projectId}/sessions` });
  };

  const handleCreateSession = (prompt: string) => {
    createSessionFromPrompt({
      projectId,
      prompt,
      agent: lastSelectedAgent,
      model,
      createSession: createSession.mutate,
      openSession: handleSelectSession,
    });
  };

  const handleOpenInBubble = () => {
    openSessionBubbleAndGoBack({
      sessionId: selectedSessionId,
      setSessionModalState,
      setSelectedSessionId,
      navigateBack: () => {
        if (typeof window !== "undefined" && window.history.length > 1) {
          window.history.back();
          return;
        }

        navigate({ to: projectId ? `/projects/${projectId}` : "/projects" });
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
              sessions={visibleSessions}
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
              <Tooltip content={t("chatInput.session.openInBubble")}>
                <IconButton
                  size="xs"
                  variant="ghost"
                  aria-label={t("chatInput.session.openInBubble")}
                  onClick={handleOpenInBubble}
                >
                  <ArrowLeft size={16} />
                </IconButton>
              </Tooltip>
              {downloadableSession ? (
                <SessionActionMenu
                  onDownloadSession={() => downloadSessionJson(downloadableSession)}
                  onArchiveSession={handleArchive}
                />
              ) : null}
            </HStack>
          </HorizontalMenuStack>

          <Stack flex="1" minH="0" px="sm" pb="sm" align="flex-start">
            <Stack flex="1" minH="0" w="full" maxW="52rem">
              <SessionChatView
                sessionId={selectedSessionId}
                onCreateSession={handleCreateSession}
                repoMenu={
                  <HStack justify="space-between" align="center" wrap="wrap" w="full">
                    <AgentBrowserContainer />
                    <RepoBrowserContainer lockedBranch={workspace?.branch} />
                  </HStack>
                }
              />
            </Stack>
          </Stack>
        </Stack>
      </Flex>
    </Flex>
  );
};
