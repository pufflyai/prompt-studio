import { Stack } from "@chakra-ui/react";
import { toaster } from "@pstdio/ui";
import type { ShellLayout, ShellWidgetPlacement, ShellWidgetRenderInput, TreeViewSection } from "pstdio-shell/core";
import { useShellStore } from "pstdio-shell/react";
import { useEffect, useRef } from "react";
import { apiRequest } from "@/lib/api";
import { SELECTED_PROJECT_CONTEXT_KEY } from "../../projects/constants";
import { SessionConversation } from "../components/session-conversation";
import { SESSION_RESOURCE_KIND, SESSIONS_NAVIGATION_TREE_ID } from "../constants";
import { recordSessionSwitchStep } from "../data/session-switch-diagnostics";
import { createSessionsNavigationSignature } from "../data/sessions-navigation-signature";
import { useSessions } from "../data/use-sessions";
import { createSessionsNavigationSections } from "../navigation";
import { createSessionResource, createSessionsResource } from "../resources";

export interface SessionsNavigationState {
  getSections: () => TreeViewSection[];
}

export interface SessionsNavigationController {
  current: SessionsNavigationState;
}

export const createEmptySessionsNavigationState = (): SessionsNavigationState => ({
  getSections: () => [],
});

const findWidgetPlacement = (layout: ShellLayout, widgetId: string) => {
  for (const area of Object.values(layout.areas)) {
    const placement = area.widgets.find((candidate) => candidate.widgetId === widgetId);
    if (placement) return placement;
  }

  return undefined;
};

const getSelectedSessionId = (placement: ShellWidgetPlacement) => {
  const resource = placement.resource;
  return resource?.kind === SESSION_RESOURCE_KIND && resource.id ? resource.id : null;
};

export const SessionsWidget = (props: { input: ShellWidgetRenderInput; navigation: SessionsNavigationController }) => {
  const { input, navigation } = props;
  const { sessions: allSessions, isLoading } = useSessions();
  // The shell swaps placement resources while reusing the widget instance, so read placement from live layout state.
  const placement =
    useShellStore(input.shell.layout.store, (state) => findWidgetPlacement(state.layout, input.placement.widgetId)) ??
    input.placement;
  const selectedProjectId = useShellStore(
    input.shell.context.store,
    (state) => state.values[SELECTED_PROJECT_CONTEXT_KEY] as string | undefined,
  );
  const sessions = allSessions.filter((session) => session.projectId === selectedProjectId);
  const selectedSessionId = getSelectedSessionId(placement);
  const selectedResourceUri = placement.resource?.uri;
  const selectedNodeId = selectedSessionId ? `session:${selectedSessionId}` : "sessions:new";
  const sessionsNavigationSignature = createSessionsNavigationSignature(sessions);

  // When the project switches, land on that project's most recent session — or its sessions root if it has none.
  // Skip the initial undefined→first-project default so direct-from-URL session views are preserved.
  const previousProjectIdRef = useRef(selectedProjectId);
  useEffect(() => {
    const previous = previousProjectIdRef.current;
    previousProjectIdRef.current = selectedProjectId;
    if (!previous || previous === selectedProjectId || !selectedProjectId) return;
    if (selectedSessionId && sessions.some((session) => session.id === selectedSessionId)) return;
    const mostRecent = sessions[0];
    void input.shell.resources.openResource(
      mostRecent
        ? createSessionResource(selectedProjectId, mostRecent.id, mostRecent.title)
        : createSessionsResource(selectedProjectId),
    );
  }, [selectedProjectId, selectedSessionId, sessions, input.shell.resources]);

  const getCurrentSelectedSessionId = () => {
    const currentPlacement = findWidgetPlacement(input.shell.layout.getLayout(), input.placement.widgetId);
    return getSelectedSessionId(currentPlacement ?? input.placement);
  };

  const archiveSession = async (sessionId: string) => {
    await apiRequest(`/v1/sessions/${sessionId}/archive`, { method: "POST" });

    if (sessionId === getCurrentSelectedSessionId() && selectedProjectId) {
      void input.shell.resources.openResource(createSessionsResource(selectedProjectId));
    }
  };

  const copyAgentSessionId = async (agentSessionId: string) => {
    await navigator.clipboard.writeText(agentSessionId);
    toaster.create({
      type: "success",
      title: "Copied agent session ID",
      description: agentSessionId,
    });
  };

  navigation.current = {
    getSections: () =>
      selectedProjectId
        ? createSessionsNavigationSections({
            projectId: selectedProjectId,
            sessions,
            onOpenSessions: () => {
              void input.shell.resources.openResource(createSessionsResource(selectedProjectId));
            },
            onArchiveSession: (sessionId) => {
              void archiveSession(sessionId);
            },
            onCopyAgentSessionId: (agentSessionId) => {
              void copyAgentSessionId(agentSessionId);
            },
          })
        : [],
  };

  useEffect(() => {
    if (!input.shell.trees.getTreeView(SESSIONS_NAVIGATION_TREE_ID)) return;

    input.shell.trees.setSelectedNode(SESSIONS_NAVIGATION_TREE_ID, selectedNodeId);
    recordSessionSwitchStep({
      sessionId: selectedSessionId,
      resourceUri: selectedResourceUri,
      step: "tree.select",
      metadata: { selectedNodeId },
    });
  }, [input.shell.trees, selectedNodeId, selectedResourceUri, selectedSessionId]);

  useEffect(() => {
    if (!input.shell.trees.getTreeView(SESSIONS_NAVIGATION_TREE_ID)) return;

    input.shell.trees.setLoading(SESSIONS_NAVIGATION_TREE_ID, isLoading);
    input.shell.trees.refresh(SESSIONS_NAVIGATION_TREE_ID);
    recordSessionSwitchStep({
      source: "tree",
      step: "tree.refresh",
      metadata: { isLoading, selectedProjectId, sessionCount: sessions.length, sessionsNavigationSignature },
    });
  }, [input.shell.trees, isLoading, selectedProjectId, sessions.length, sessionsNavigationSignature]);

  useEffect(() => {
    recordSessionSwitchStep({
      sessionId: selectedSessionId,
      resourceUri: selectedResourceUri,
      step: "widget.commit",
      metadata: { selectedNodeId },
    });
  }, [selectedNodeId, selectedResourceUri, selectedSessionId]);

  return (
    <Stack flex="1" minW="0" minH="0" h="full" gap="0" overflow="hidden">
      <Stack flex="1" minH="0" minW="0" h="full" px="sm" pb="sm" align="center" overflow="hidden">
        {/* Keep the conversation width aligned with the original dashboard; the shell owns the outer chrome. */}
        <Stack flex="1" minH="0" minW="0" h="full" w="full" maxW="52rem" overflow="hidden">
          <SessionConversation
            sessionId={selectedSessionId}
            newSessionProjectId={selectedProjectId ?? null}
            onSessionCreated={(sessionId) => {
              if (!selectedProjectId) return;
              void input.shell.resources.openResource(createSessionResource(selectedProjectId, sessionId));
            }}
          />
        </Stack>
      </Stack>
    </Stack>
  );
};
