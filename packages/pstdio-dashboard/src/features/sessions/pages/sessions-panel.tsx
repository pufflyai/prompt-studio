import { HStack, IconButton, Stack, Text } from "@chakra-ui/react";
import { HorizontalMenuStack, PanelLayout, Tooltip } from "@pstdio/ui";
import { useNavigate, useParams } from "@tanstack/react-router";
import { Archive, SquareArrowOutDownRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ActionParamsDialog } from "@/features/plugin-actions/components/action-params-dialog";
import type { HeaderActionItem } from "@/features/plugin-actions/components/header-action-groups";
import { PluginHeaderActions } from "@/features/plugin-actions/components/plugin-header-actions";
import { usePluginActionTrigger } from "@/features/plugin-actions/hooks/use-plugin-action-trigger";
import { useProjectSettingsStore } from "@/features/project-settings/store";
import { SessionChatView } from "../components/session-chat-view";
import { SessionsSidebar } from "../components/sessions-sidebar";
import { useArchiveSession } from "../hooks/use-archive-session";
import { useProjectSessions } from "../hooks/use-project-sessions";
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

  const { data: sessions = [] } = useProjectSessions(projectId);
  const visibleSessions = getVisibleSessions(sessions);
  const archiveSession = useArchiveSession();
  const selectedSession = visibleSessions.find((item) => item.id === selectedSessionId) ?? null;

  const pluginActionTrigger = usePluginActionTrigger({
    projectId,
    targetType: "session",
    onSuccess: async (result) => {
      if (!projectId || !result.session_id) return;
      navigate({ to: `/projects/${projectId}/sessions/${result.session_id}` });
    },
  });

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

  const defaultOverflowActions: HeaderActionItem[] = selectedSessionId
    ? [
        {
          key: "archive-session",
          label: t("sessions.archiveSession"),
          kind: "default",
          icon: Archive,
          onClick: () => {
            archiveSession.mutate(selectedSessionId);
            navigate({ to: `/projects/${projectId}/sessions` });
          },
        },
      ]
    : [];

  const sidebar = (
    <SessionsSidebar
      sessions={visibleSessions}
      selectedSessionId={selectedSessionId}
      onSelectSession={handleSelectSession}
    />
  );

  return (
    <PanelLayout sidebar={sidebar}>
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

            <PluginHeaderActions
              pluginActions={selectedSessionId ? pluginActionTrigger.pluginActions : []}
              defaultOverflowActions={defaultOverflowActions}
              onPluginAction={(actionKey) => {
                if (!selectedSessionId) return;
                void pluginActionTrigger.trigger(actionKey, selectedSessionId);
              }}
              pendingActionKey={pluginActionTrigger.pendingActionKey}
              isExecuting={pluginActionTrigger.isExecuting}
              overflowLabel={t("sessions.sessionActions")}
            />
          </HStack>
        </HorizontalMenuStack>

        <Stack flex="1" minH="0" px="sm" pb="sm" align="flex-start">
          <Stack flex="1" minH="0" w="full" maxW="52rem">
            <SessionChatView sessionId={selectedSessionId} onSessionCreated={handleSelectSession} />
          </Stack>
        </Stack>
      </Stack>

      {pluginActionTrigger.activeParamAction && projectId ? (
        <ActionParamsDialog
          open
          action={pluginActionTrigger.activeParamAction}
          projectId={projectId}
          isSubmitting={pluginActionTrigger.isExecuting}
          onClose={pluginActionTrigger.cancelParams}
          onSubmit={(params) => pluginActionTrigger.submitWithParams(params)}
        />
      ) : null}
    </PanelLayout>
  );
};
