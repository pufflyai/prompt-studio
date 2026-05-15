import { Box, Stack } from "@chakra-ui/react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { ShellWorkbench } from "pstdio-shell/react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ActionParamsDialog } from "@/features/plugin-actions/components/action-params-dialog";
import type { HeaderActionItem } from "@/features/plugin-actions/components/header-action-groups";
import { usePluginActionTrigger } from "@/features/plugin-actions/hooks/use-plugin-action-trigger";
import { useDeferredPageMount } from "@/shared/performance/use-deferred-page-mount";
import { buildShellTreeContextMenuActions, registerShellHeaderActions } from "@/shared/shell/register-header-actions";
import {
  createSessionResource,
  createSessionsResource,
  type DashboardSessionsNavigationState,
  SESSIONS_CHAT_WIDGET_ID,
  SESSIONS_NAVIGATION_TREE_ID,
} from "@/shared/shell/sessions/dashboard-sessions-module";
import { useUnifiedShell } from "@/shared/shell/unified-shell-host";
import { useProjectNavigationHeaderRenderer } from "@/shared/shell/use-project-navigation-header-renderer";
import { SessionChatView } from "../components/session-chat-view";
import { useArchiveSession } from "../hooks/use-archive-session";
import { useProjectSessions } from "../hooks/use-project-sessions";
import { buildSessionOverflowActions } from "../session-actions";
import { getVisibleSessions } from "../utils/visible-sessions";
import { createSessionsNavigationSections } from "./sessions-shell-navigation";

interface SessionsShellMainWidgetProps {
  chatViewMounted: boolean;
  selectedSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
}

const SESSION_HEADER_ACTION_COMMAND_PREFIX = "sessions.headerAction";

const resolveSessionHeaderActionIcon = (action: HeaderActionItem) => {
  if (action.key === "copy-agent-session-id") return "Copy";
  if (action.key.startsWith("archive-session:")) return "Archive";
  return undefined;
};

const SessionsShellMainWidget = (props: SessionsShellMainWidgetProps) => {
  const { chatViewMounted, selectedSessionId, onSelectSession } = props;

  return (
    <Stack flex="1" minW="0" minH="0" h="full" gap="0" overflow="hidden">
      <Stack flex="1" minH="0" minW="0" h="full" px="sm" pb="sm" align="center" overflow="hidden">
        <Stack flex="1" minH="0" minW="0" h="full" w="full" maxW="52rem" overflow="hidden">
          {chatViewMounted ? (
            <SessionChatView sessionId={selectedSessionId} onSessionCreated={onSelectSession} />
          ) : (
            <Box flex="1" />
          )}
        </Stack>
      </Stack>
    </Stack>
  );
};

const SessionsPanelContent = (props: { projectId?: string; sessionId?: string }) => {
  const { projectId, sessionId } = props;
  const { t } = useTranslation("projects");
  const navigate = useNavigate();
  const selectedSessionId = typeof sessionId === "string" ? sessionId : null;
  const { data: sessions = [] } = useProjectSessions(projectId);
  const visibleSessions = getVisibleSessions(sessions);
  const archiveSession = useArchiveSession();
  const selectedSession = visibleSessions.find((item) => item.id === selectedSessionId) ?? null;
  const resolvedProjectId = projectId ?? "";
  const localNavigationRef = useRef<DashboardSessionsNavigationState>({
    getSections: () => [],
  });
  const sessionsShell = useUnifiedShell();
  const navigationRef = sessionsShell.sessionsNavigation ?? localNavigationRef;

  const chatViewMounted = useDeferredPageMount("sessions", `${projectId ?? ""}:${selectedSessionId ?? ""}`);

  const pluginActionTrigger = usePluginActionTrigger({
    projectId,
    targetType: "session",
    onSuccess: async (result) => {
      if (!projectId || !result.session_id) return;
      navigate({ to: `/projects/${projectId}/sessions/${result.session_id}` });
    },
  });

  useProjectNavigationHeaderRenderer(sessionsShell, "back-to-dashboard");

  useEffect(() => {
    if (selectedSessionId) {
      sessionsShell.context.set("sessionId", selectedSessionId);
    } else {
      sessionsShell.context.delete("sessionId");
    }
  }, [selectedSessionId, sessionsShell]);

  const handleSelectSession = (nextSessionId: string) => {
    void sessionsShell.resources.openResource(createSessionResource(resolvedProjectId, nextSessionId));
  };

  const agentSessionId = selectedSession?.agentSessionId ?? null;
  const sessionActionsLabel = t("sessions.sessionActions");

  const defaultOverflowActions: HeaderActionItem[] = selectedSessionId
    ? buildSessionOverflowActions({
        sessionId: selectedSessionId,
        agentSessionId,
        onArchive: () => {
          archiveSession.mutate(selectedSessionId);
          void sessionsShell.resources.openResource(createSessionsResource(resolvedProjectId));
        },
        t,
      })
    : [];

  navigationRef.current = {
    getSections: () =>
      createSessionsNavigationSections({
        projectId: resolvedProjectId,
        sessions: visibleSessions,
        onArchiveSession: (nextSessionId) => {
          archiveSession.mutate(nextSessionId);
          if (nextSessionId === selectedSessionId) {
            void sessionsShell.resources.openResource(createSessionsResource(resolvedProjectId));
          }
        },
        onCreateSession: () => {
          void sessionsShell.resources.openResource(createSessionsResource(resolvedProjectId));
        },
        resolveSessionContextMenuActions: (session) =>
          buildShellTreeContextMenuActions({
            defaultOverflowActions: buildSessionOverflowActions({
              sessionId: session.id,
              agentSessionId: session.agentSessionId,
              onArchive: () => {
                archiveSession.mutate(session.id);
                if (session.id === selectedSessionId) {
                  void sessionsShell.resources.openResource(createSessionsResource(resolvedProjectId));
                }
              },
              t,
            }),
            onPluginAction: (actionKey, targetId) => void pluginActionTrigger.trigger(actionKey, targetId),
            pendingActionKeys: pluginActionTrigger.pendingActionKeys,
            pluginActions: pluginActionTrigger.pluginActions,
            resolveIcon: resolveSessionHeaderActionIcon,
            targetId: session.id,
          }),
      }),
  };
  const sessionsNavigationRefreshKey = visibleSessions
    .map((session) => `${session.id}:${session.title}:${session.status}`)
    .join("|");
  const sessionsNavigationStateKey = `${
    selectedSessionId ? `session:${selectedSessionId}` : "sessions:new"
  }|${sessionsNavigationRefreshKey}`;

  useEffect(() => {
    const resource = selectedSessionId
      ? createSessionResource(resolvedProjectId, selectedSessionId, selectedSession?.title)
      : createSessionsResource(resolvedProjectId);

    sessionsShell.layout.openWidget(SESSIONS_CHAT_WIDGET_ID, { resource, closable: false });
  }, [resolvedProjectId, selectedSession?.title, selectedSessionId, sessionsShell]);

  useEffect(() => {
    const items = [
      { title: "Project", icon: "FolderKanban" },
      { title: "Sessions", icon: "MessageCircle" },
    ];
    if (selectedSession) items.push({ title: selectedSession.title, icon: "Terminal" });

    const subscription = sessionsShell.breadcrumbs.setItems(items);
    return () => subscription.dispose();
  }, [selectedSession, sessionsShell]);

  useEffect(() => {
    const main = sessionsShell.renderers.registerRenderer({
      id: SESSIONS_CHAT_WIDGET_ID,
      render: () => (
        <SessionsShellMainWidget
          chatViewMounted={chatViewMounted}
          selectedSessionId={selectedSessionId}
          onSelectSession={handleSelectSession}
        />
      ),
    });

    return () => {
      main.dispose();
    };
  });

  useEffect(() => {
    if (!selectedSessionId) return;

    return registerShellHeaderActions({
      category: "Sessions",
      commandPrefix: SESSION_HEADER_ACTION_COMMAND_PREFIX,
      defaultOverflowActions,
      onPluginAction: (actionKey, sessionId) => void pluginActionTrigger.trigger(actionKey, sessionId),
      overflowLabel: sessionActionsLabel,
      pendingActionKeys: pluginActionTrigger.pendingActionKeys,
      pluginActions: pluginActionTrigger.pluginActions,
      resolveIcon: resolveSessionHeaderActionIcon,
      shell: sessionsShell,
      targetId: selectedSessionId,
    });
  }, [
    defaultOverflowActions,
    pluginActionTrigger.pendingActionKeys,
    pluginActionTrigger.pluginActions,
    pluginActionTrigger.trigger,
    selectedSessionId,
    sessionActionsLabel,
    sessionsShell,
  ]);

  useEffect(() => {
    const [selectedNodeId] = sessionsNavigationStateKey.split("|");
    sessionsShell.trees.setSelectedNode(SESSIONS_NAVIGATION_TREE_ID, selectedNodeId);
    sessionsShell.trees.refresh(SESSIONS_NAVIGATION_TREE_ID);
  }, [sessionsNavigationStateKey, sessionsShell]);

  return (
    <>
      <ShellWorkbench shell={sessionsShell} />

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
    </>
  );
};

export const SessionsPanel = () => {
  const { projectId, sessionId } = useParams({ strict: false });

  return <SessionsPanelContent key={projectId ?? "sessions"} projectId={projectId} sessionId={sessionId} />;
};
