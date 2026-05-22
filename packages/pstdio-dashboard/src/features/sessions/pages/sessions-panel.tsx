import { Box, Flex, HStack, Stack, Text } from "@chakra-ui/react";
import { HorizontalMenuStack, PanelLayout } from "@pstdio/ui";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ExtensionMenuSlot } from "@/shared/extensions/components/extension-menu-slot";
import { type HeaderActionItem, HeaderActions } from "@/shared/extensions/components/header-actions";
import {
  headerActionsToResourceContextActions,
  toSidebarContextMenuItems,
} from "@/shared/extensions/context-menu-actions";
import { useExtensionHeaderActions } from "@/shared/extensions/hooks/use-extension-header-actions";
import { useExtensionResourceContextMenuActions } from "@/shared/extensions/hooks/use-extension-resource-context-menu-actions";
import type { ExtensionResourceContext } from "@/shared/extensions/types";
import { useDeferredPageMount } from "@/shared/performance/use-deferred-page-mount";
import { OpenSidebarButton } from "@/shared/sidebar/open-sidebar-button";
import { SessionChatView } from "../components/session-chat-view";
import { SESSIONS_SIDEBAR_STORAGE_KEY, SessionsSidebar } from "../components/sessions-sidebar";
import { useArchiveSession } from "../hooks/use-archive-session";
import { useProjectSessions } from "../hooks/use-project-sessions";
import { buildSessionOverflowActions } from "../session-actions";
import { getVisibleSessions } from "../utils/visible-sessions";

const buildSessionResource = (input: {
  projectId: string | undefined;
  session: { id: string; title: string; agentSessionId?: string | null } | null;
}): ExtensionResourceContext | undefined => {
  const { projectId, session } = input;
  if (!projectId || !session) return undefined;

  return {
    type: "session",
    id: session.id,
    label: session.title,
    projectId,
    metadata: session.agentSessionId ? { agentSessionId: session.agentSessionId } : {},
  };
};

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

  const handleSelectSession = (nextSessionId: string) => {
    navigate({ to: `/projects/${projectId}/sessions/${nextSessionId}` });
  };

  const handleCreateSession = () => {
    navigate({ to: `/projects/${projectId}/sessions` });
  };

  const agentSessionId = selectedSession?.agentSessionId ?? null;
  const sessionResource = buildSessionResource({ projectId, session: selectedSession });

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
  const extensionOverflowActions = useExtensionHeaderActions({
    slotId: "session.headerOverflow",
    resource: sessionResource,
    enabled: Boolean(sessionResource),
  });
  const sessionContextMenuActions = useExtensionResourceContextMenuActions({
    slotId: ["session.headerPrimary", "session.headerOverflow"],
  });
  const headerOverflowActions = [...defaultOverflowActions, ...extensionOverflowActions.actions];
  const headerPendingActionKeys = extensionOverflowActions.pendingActionKeys;

  const sidebar = (
    <SessionsSidebar
      sessions={visibleSessions}
      selectedSessionId={selectedSessionId}
      onSelectSession={handleSelectSession}
      onCreateSession={handleCreateSession}
      resolveContextMenuItems={(session) =>
        toSidebarContextMenuItems([
          ...sessionContextMenuActions.resolveActions(buildSessionResource({ projectId, session })),
          ...headerActionsToResourceContextActions({
            actions: buildSessionOverflowActions({
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
          }),
        ])
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
            <ExtensionMenuSlot
              slotId="session.headerPrimary"
              mode="buttons"
              resource={sessionResource}
              enabled={Boolean(sessionResource)}
            />
            <HeaderActions
              overflowActions={headerOverflowActions}
              pendingActionKeys={headerPendingActionKeys}
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

      {extensionOverflowActions.paramsDialog}
      {sessionContextMenuActions.paramsDialog}
    </PanelLayout>
  );
};
