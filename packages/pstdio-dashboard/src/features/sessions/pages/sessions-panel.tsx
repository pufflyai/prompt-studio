import { Box, Flex, HStack, Stack, Text } from "@chakra-ui/react";
import { HorizontalMenuStack, PanelLayout } from "@pstdio/ui";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ActionParamsDialog } from "@/features/plugin-actions/components/action-params-dialog";
import type { HeaderActionItem } from "@/features/plugin-actions/components/header-action-groups";
import { PluginHeaderActions } from "@/features/plugin-actions/components/plugin-header-actions";
import { usePluginActionTrigger } from "@/features/plugin-actions/hooks/use-plugin-action-trigger";
import {
  buildResourceContextMenuActions,
  toSidebarContextMenuItems,
} from "@/features/plugin-actions/hooks/use-resource-context-menu";
import { useDeferredPageMount } from "@/shared/performance/use-deferred-page-mount";
import { OpenSidebarButton } from "@/shared/sidebar/open-sidebar-button";
import { SessionChatView } from "../components/session-chat-view";
import { SESSIONS_SIDEBAR_STORAGE_KEY, SessionsSidebar } from "../components/sessions-sidebar";
import { useArchiveSession } from "../hooks/use-archive-session";
import { useProjectSessions } from "../hooks/use-project-sessions";
import { buildSessionOverflowActions } from "../session-actions";
import { getVisibleSessions } from "../utils/visible-sessions";

export const SessionsPanel = () => {
  const { t } = useTranslation("projects");
  const { projectId, sessionId } = useParams({ strict: false });
  const navigate = useNavigate();
  const selectedSessionId = typeof sessionId === "string" ? sessionId : null;

  const { data: sessions = [] } = useProjectSessions(projectId);
  const visibleSessions = getVisibleSessions(sessions);
  const archiveSession = useArchiveSession();
  const selectedSession = visibleSessions.find((item) => item.id === selectedSessionId) ?? null;

  const chatViewMounted = useDeferredPageMount("sessions", `${projectId ?? ""}:${selectedSessionId ?? ""}`);

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

  const handleCreateSession = () => {
    navigate({ to: `/projects/${projectId}/sessions` });
  };

  const agentSessionId = selectedSession?.agentSessionId ?? null;

  const defaultOverflowActions: HeaderActionItem[] = selectedSessionId
    ? buildSessionOverflowActions({
        sessionId: selectedSessionId,
        agentSessionId,
        onArchive: () => {
          archiveSession.mutate(selectedSessionId);
          navigate({ to: `/projects/${projectId}/sessions` });
        },
        t,
      })
    : [];

  const sidebar = (
    <SessionsSidebar
      sessions={visibleSessions}
      selectedSessionId={selectedSessionId}
      onSelectSession={handleSelectSession}
      onCreateSession={handleCreateSession}
      resolveContextMenuItems={(session) =>
        toSidebarContextMenuItems(
          buildResourceContextMenuActions({
            pluginActions: pluginActionTrigger.pluginActions,
            defaultOverflowActions: buildSessionOverflowActions({
              sessionId: session.id,
              agentSessionId: session.agentSessionId,
              onArchive: () => {
                archiveSession.mutate(session.id);
                if (session.id === selectedSessionId) {
                  navigate({ to: `/projects/${projectId}/sessions` });
                }
              },
              t,
            }),
            pendingActionKeys: pluginActionTrigger.pendingActionKeys,
            onPluginAction: (actionKey) => void pluginActionTrigger.trigger(actionKey, session.id),
          }),
        )
      }
    />
  );

  return (
    <PanelLayout sidebar={sidebar}>
      <Stack flex="1" minW="0" minH="0" gap="0">
        <HorizontalMenuStack>
          <Flex align="center" gap="sm" minW="0">
            <OpenSidebarButton storageKey={SESSIONS_SIDEBAR_STORAGE_KEY} />
            <Text textStyle="label/S/medium" color="foreground.primary" lineClamp={1}>
              {selectedSession?.title ?? t("sessions.newSession")}
            </Text>
          </Flex>

          <HStack gap="2xs">
            <PluginHeaderActions
              pluginActions={selectedSessionId ? pluginActionTrigger.pluginActions : []}
              defaultOverflowActions={defaultOverflowActions}
              onPluginAction={(actionKey) => {
                if (!selectedSessionId) return;
                void pluginActionTrigger.trigger(actionKey, selectedSessionId);
              }}
              pendingActionKeys={pluginActionTrigger.pendingActionKeys}
              overflowLabel={t("sessions.sessionActions")}
            />
          </HStack>
        </HorizontalMenuStack>

        <Stack flex="1" minH="0" px="sm" pb="sm" align="center">
          <Stack flex="1" minH="0" w="full" maxW="52rem">
            {chatViewMounted ? (
              <SessionChatView sessionId={selectedSessionId} onSessionCreated={handleSelectSession} />
            ) : (
              <Box flex="1" />
            )}
          </Stack>
        </Stack>
      </Stack>

      {pluginActionTrigger.activeParamAction && projectId ? (
        <ActionParamsDialog
          open
          action={pluginActionTrigger.activeParamAction}
          projectId={projectId}
          isSubmitting={pluginActionTrigger.activeParamActionIsPending}
          onClose={pluginActionTrigger.cancelParams}
          onSubmit={(params) => pluginActionTrigger.submitWithParams(params)}
        />
      ) : null}
    </PanelLayout>
  );
};
