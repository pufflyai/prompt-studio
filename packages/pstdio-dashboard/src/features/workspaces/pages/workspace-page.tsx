import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { usePluginActionTrigger } from "@/features/plugin-actions/hooks/use-plugin-action-trigger";
import {
  buildResourceContextMenuActions,
  toSidebarContextMenuItems,
} from "@/features/plugin-actions/hooks/use-resource-context-menu";
import { useProject } from "@/features/project/hooks/use-project";
import { useArchiveSession } from "@/features/sessions/hooks/use-archive-session";
import { buildSessionOverflowActions } from "@/features/sessions/session-actions";
import { useTicketAttemptDiff } from "@/features/ticket/hooks/use-ticket-attempt-diff";
import { useTicketFiles } from "@/features/ticket/hooks/use-ticket-files";
import { buildTicketOverflowActions } from "@/features/ticket/pages/ticket-details-actions";
import { openTicketSessionBubble } from "@/features/ticket/utils/open-ticket-session-bubble";
import { resolveSidebarSubTickets } from "@/features/ticket/utils/sidebar-sub-tickets";
import { buildSelectableTicketFiles } from "@/features/ticket/utils/ticket-file-selection";
import { useCreateTicketAttempt } from "@/features/ticket-list/hooks/use-create-ticket-attempt";
import {
  useDeleteProjectTicket,
  useProjectTickets,
  useUpdateProjectTicket,
} from "@/features/ticket-list/hooks/use-project-tickets";
import {
  shouldFetchTicketAttemptDiff,
  useTicketAttemptDiffs,
} from "@/features/ticket-list/hooks/use-ticket-attempt-diffs";
import { transformFileDiffs } from "@/features/workspaces/utils/transform-diff";
import { useProjectSettingsStore, useProjectSettingsStoreApi } from "@/shared/stores/project-settings";
import { useAttemptStatusMap } from "../hooks/use-attempt-status-map";
import { useDeleteWorkspace } from "../hooks/use-workspace-actions";
import { useWorkspaceSessions } from "../hooks/use-workspace-sessions";
import { resolveActiveWorkspaceSessionId } from "../utils/selected-workspace-session";
import { resolveWorkspaceSelection } from "../utils/workspace-selection";
import { useWorkspaceSessionDraft } from "./use-workspace-session-draft";
import { resolveWorkspacePageAutoOpenSession } from "./workspace-page-auto-open-session";
import { WorkspacePageContent } from "./workspace-page-content";
import {
  buildWorkspaceListItems,
  navigateToCreatedWorkspace,
  navigateToProjectTickets,
  navigateToTicketDetails,
  navigateToWorkspaceTab,
  runDeleteWorkspaceFlow,
  runWorkspaceCreation,
  useWorkspaceSessionSearchNormalization,
} from "./workspace-page-helpers";
import { normalizeWorkspacePageTab } from "./workspace-page-tab";
import { WorkspacePageTicketNotFound } from "./workspace-page-ticket-not-found";

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: This page coordinates route state, multiple action triggers, and modal flows for the workspace surface.
export const WorkspacePage = () => {
  const { projectId, ticketShorthand, workspaceShorthand } = useParams({ strict: false });
  const search = useSearch({ strict: false });
  const sessionId = typeof search.sessionId === "string" ? search.sessionId : undefined;
  const requestedTab = typeof search.tab === "string" ? search.tab : undefined;
  const activeTab = normalizeWorkspacePageTab(search.tab);
  const navigate = useNavigate();
  const { t } = useTranslation(["projects", "tickets"]);
  const [isCreateWorkspaceModalOpen, setIsCreateWorkspaceModalOpen] = useState(false);
  const [isDeleteOpen, setDeleteOpen] = useState(false);
  const [isTicketDeleteOpen, setTicketDeleteOpen] = useState(false);
  const projectSettingsStore = useProjectSettingsStoreApi();
  const setSessionModalState = useProjectSettingsStore((state) => state.setSessionModalState);
  const setSelectedSessionId = useProjectSettingsStore((state) => state.setSelectedSessionId);
  const lastAutoOpenedRouteKeyRef = useRef<string | null>(null);
  const { data: project } = useProject(projectId);
  const { data: allTickets = [] } = useProjectTickets(projectId);
  const ticket = allTickets.find((item) => item.shorthand === ticketShorthand) ?? null;
  const sidebarSubTickets = ticket ? resolveSidebarSubTickets(allTickets, ticket.id, ticket.shorthand) : [];
  const attempts = ticket?.attempts ?? [];
  const attemptStatusMap = useAttemptStatusMap(projectId);
  const createAttempt = useCreateTicketAttempt(projectId);
  const deleteWorkspace = useDeleteWorkspace();
  const updateTicket = useUpdateProjectTicket(projectId);
  const deleteTicket = useDeleteProjectTicket(projectId);
  const archiveSession = useArchiveSession();
  const lastSelectedBranches = useProjectSettingsStore((state) => state.lastSelectedBranches);
  const lastSelectedRepo = useProjectSettingsStore((state) => state.lastSelectedRepo);
  const attemptDiffInputs = attempts.map((attempt) => ({
    workspaceId: attempt.id,
    shouldFetch: shouldFetchTicketAttemptDiff(attempt),
  }));
  const { diffTotalsByWorkspaceId } = useTicketAttemptDiffs(attemptDiffInputs);
  const workspaces = buildWorkspaceListItems(attempts, attemptStatusMap);
  const workspaceIds = workspaces.map((workspace) => workspace.id);
  const workspaceSessions = useWorkspaceSessions(workspaceIds);
  const sessionsByWorkspaceId = workspaceSessions.sessionsByWorkspaceId;
  const selectedWorkspace = workspaces.find((workspace) => workspace.shorthand === workspaceShorthand) ?? null;
  const selectedWorkspaceSessions = selectedWorkspace ? (sessionsByWorkspaceId.get(selectedWorkspace.id) ?? []) : [];
  const activeSessionId = resolveActiveWorkspaceSessionId(selectedWorkspaceSessions, sessionId);
  const selectedWorkspaceLabel = selectedWorkspace?.shorthand ?? workspaceShorthand ?? "";
  useWorkspaceSessionSearchNormalization({
    projectId,
    ticketShorthand,
    workspaceShorthand,
    requestedSessionId: sessionId,
    requestedTab,
    activeSessionId,
    areWorkspaceSessionsReady: workspaceSessions.isReady,
    navigate,
  });
  useEffect(() => {
    const autoOpenRouteKey = sessionId
      ? null
      : `${projectId ?? ""}:${ticketShorthand ?? ""}:${workspaceShorthand ?? ""}`;
    const sessionIdToOpen = resolveWorkspacePageAutoOpenSession({
      isWorkspaceSessionsReady: workspaceSessions.isReady,
      requestedSessionId: sessionId,
      activeSessionId,
      hasAutoOpenedSession: autoOpenRouteKey === lastAutoOpenedRouteKeyRef.current,
    });
    if (!sessionIdToOpen) return;

    lastAutoOpenedRouteKeyRef.current = autoOpenRouteKey;

    openTicketSessionBubble({
      sessionId: sessionIdToOpen,
      sessionModalState: projectSettingsStore.getState().sessionModalState,
      setSessionModalState,
      setSelectedSessionId,
    });
  }, [
    activeSessionId,
    projectId,
    projectSettingsStore,
    sessionId,
    setSelectedSessionId,
    setSessionModalState,
    ticketShorthand,
    workspaceSessions.isReady,
    workspaceShorthand,
  ]);

  const pluginActionTrigger = usePluginActionTrigger({
    projectId,
    targetType: "workspace",
    onSuccess: async (result) => {
      if (!result.session_id) return;
      openTicketSessionBubble({
        sessionId: result.session_id,
        sessionModalState: projectSettingsStore.getState().sessionModalState,
        setSessionModalState,
        setSelectedSessionId,
      });
    },
  });

  const ticketActionTrigger = usePluginActionTrigger({
    projectId,
    targetType: "ticket",
    onSuccess: async (result) => {
      if (!result.session_id) return;
      openTicketSessionBubble({
        sessionId: result.session_id,
        sessionModalState: projectSettingsStore.getState().sessionModalState,
        setSessionModalState,
        setSelectedSessionId,
      });
    },
  });

  const sessionActionTrigger = usePluginActionTrigger({
    projectId,
    targetType: "session",
    onSuccess: async (result) => {
      if (!result.session_id) return;
      openTicketSessionBubble({
        sessionId: result.session_id,
        sessionModalState: projectSettingsStore.getState().sessionModalState,
        setSessionModalState,
        setSelectedSessionId,
      });
    },
  });

  const diffQuery = useTicketAttemptDiff(selectedWorkspace?.id);
  const diffData = diffQuery.data;
  const isDiffLoading = Boolean(selectedWorkspace) && (diffQuery.isPending || (diffQuery.isFetching && !diffData));
  const changedFiles = diffData?.files ?? [];
  const diffs = diffData?.files ? transformFileDiffs(diffData.files) : [];

  const ticketFiles = useTicketFiles(ticket?.id);
  const selectableFiles = buildSelectableTicketFiles(ticketFiles.data);
  const artifacts = ticketFiles.data?.artifacts ?? [];
  const handleCreateWorkspaceSessionDraft = useWorkspaceSessionDraft(selectedWorkspace?.id ?? null);
  const handleSelectWorkspace = (nextWorkspaceShorthand: string) => {
    if (!projectId || !ticketShorthand) return;

    const nextWorkspace = workspaces.find((workspace) => workspace.shorthand === nextWorkspaceShorthand);
    const nextWorkspaceSessions = nextWorkspace ? (sessionsByWorkspaceId.get(nextWorkspace.id) ?? []) : [];
    const selection = resolveWorkspaceSelection({
      sessions: nextWorkspaceSessions,
    });

    navigate({
      to: "/projects/$projectId/tickets/$ticketShorthand/workspaces/$workspaceShorthand",
      params: { projectId, ticketShorthand, workspaceShorthand: nextWorkspaceShorthand },
      search: { ...selection.search, tab: activeTab },
    });

    if (selection.shouldClearSelection) {
      setSelectedSessionId(null);
      return;
    }

    openTicketSessionBubble({
      sessionId: selection.sessionIdToOpen,
      sessionModalState: projectSettingsStore.getState().sessionModalState,
      setSessionModalState,
      setSelectedSessionId,
    });
  };

  const handleSelectSession = (nextWorkspaceShorthand: string, nextSessionId: string) => {
    if (!projectId || !ticketShorthand) return;

    navigate({
      to: "/projects/$projectId/tickets/$ticketShorthand/workspaces/$workspaceShorthand",
      params: { projectId, ticketShorthand, workspaceShorthand: nextWorkspaceShorthand },
      search: { sessionId: nextSessionId, tab: activeTab },
    });

    openTicketSessionBubble({
      sessionId: nextSessionId,
      sessionModalState: projectSettingsStore.getState().sessionModalState,
      setSessionModalState,
      setSelectedSessionId,
    });
  };

  const handleSelectSubTicket = (nextTicketShorthand: string) => {
    if (!projectId) return;

    navigate({
      to: "/projects/$projectId/tickets/$ticketShorthand",
      params: { projectId, ticketShorthand: nextTicketShorthand },
    });
  };

  const handleSelectFile = () => void navigateToTicketDetails(navigate, projectId, ticketShorthand);

  const handleCreateWorkspace = () => setIsCreateWorkspaceModalOpen(true);

  const handleCreateEmptyWorkspace = () =>
    runWorkspaceCreation({
      ticket,
      projectId,
      project,
      createAttempt,
      lastSelectedBranches,
      lastSelectedRepo,
      onSuccess: (result) => {
        navigateToCreatedWorkspace({
          navigate,
          setSelectedSessionId,
          projectId,
          ticketShorthand,
          workspaceShorthand: result.workspaceShorthand,
          tab: activeTab,
        });
      },
    });

  const handleDeleteWorkspace = () =>
    runDeleteWorkspaceFlow({
      selectedWorkspaceId: selectedWorkspace?.id ?? null,
      deleteWorkspace,
      navigate,
      projectId,
      ticketShorthand,
      closeDeleteModal: () => setDeleteOpen(false),
    });
  if (!ticket) return <WorkspacePageTicketNotFound />;

  return (
    <WorkspacePageContent
      projectId={projectId}
      ticketShorthand={ticketShorthand}
      ticket={ticket}
      sidebarSubTickets={sidebarSubTickets}
      knownTicketIds={allTickets.map((projectTicket) => projectTicket.id)}
      attemptStatusMap={attemptStatusMap}
      diffTotalsByWorkspaceId={diffTotalsByWorkspaceId}
      selectedWorkspaceLabel={selectedWorkspaceLabel}
      selectedWorkspace={selectedWorkspace}
      sessionsByWorkspaceId={sessionsByWorkspaceId}
      diffs={diffs}
      artifacts={artifacts}
      changedFiles={changedFiles}
      isDiffLoading={isDiffLoading}
      attempts={attempts}
      selectableFiles={selectableFiles}
      createAttemptIsPending={createAttempt.isPending}
      activeSessionId={activeSessionId}
      selectWorkspace={handleSelectWorkspace}
      selectSession={handleSelectSession}
      selectedTab={activeTab}
      selectTab={(tab) =>
        navigateToWorkspaceTab({ navigate, projectId, ticketShorthand, workspaceShorthand, sessionId, tab })
      }
      createWorkspaceSessionDraft={handleCreateWorkspaceSessionDraft}
      selectFile={handleSelectFile}
      selectSubTicket={handleSelectSubTicket}
      selectPlanning={() => navigateToProjectTickets(navigate, projectId)}
      isCreateWorkspaceModalOpen={isCreateWorkspaceModalOpen}
      closeCreateWorkspaceModal={() => setIsCreateWorkspaceModalOpen(false)}
      createWorkspaceLabel={t("tickets:createWorkspaceModal.createWorkspace", { defaultValue: "Create workspace" })}
      createWorkspaceDescription={t("tickets:createWorkspaceModal.createWorkspaceDescription", {
        defaultValue: "Create a workspace now and start a session later.",
      })}
      createEmptyWorkspace={handleCreateEmptyWorkspace}
      pluginActions={selectedWorkspace ? pluginActionTrigger.pluginActions : []}
      pluginActionsLoading={selectedWorkspace ? pluginActionTrigger.isActionsLoading : false}
      pluginActionTrigger={pluginActionTrigger}
      resolveTicketContextMenuItems={() =>
        toSidebarContextMenuItems(
          buildResourceContextMenuActions({
            pluginActions: ticketActionTrigger.pluginActions,
            defaultOverflowActions: buildTicketOverflowActions({
              ticket,
              projectId,
              updateTicket,
              deleteTicket,
              onDeleteOpen: () => setTicketDeleteOpen(true),
              t,
            }),
            pendingActionKeys: ticketActionTrigger.pendingActionKeys,
            onPluginAction: (actionKey) => void ticketActionTrigger.trigger(actionKey, ticket.id),
          }),
        )
      }
      resolveSessionContextMenuItems={(session) =>
        toSidebarContextMenuItems(
          buildResourceContextMenuActions({
            pluginActions: sessionActionTrigger.pluginActions,
            defaultOverflowActions: buildSessionOverflowActions({
              sessionId: session.id,
              agentSessionId: session.agentSessionId,
              onArchive: () => archiveSession.mutate(session.id),
              t,
            }),
            pendingActionKeys: sessionActionTrigger.pendingActionKeys,
            onPluginAction: (actionKey) => void sessionActionTrigger.trigger(actionKey, session.id),
          }),
        )
      }
      ticketActionTrigger={ticketActionTrigger}
      sessionActionTrigger={sessionActionTrigger}
      isTicketDeleteOpen={isTicketDeleteOpen}
      closeTicketDeleteModal={() => setTicketDeleteOpen(false)}
      deleteTicket={async () => {
        await deleteTicket.mutateAsync({ ticketId: ticket.id });
        setTicketDeleteOpen(false);
        navigateToProjectTickets(navigate, projectId);
      }}
      deleteWorkspaceIsPending={deleteWorkspace.isPending}
      isDeleteOpen={isDeleteOpen}
      openDeleteModal={() => setDeleteOpen(true)}
      closeDeleteModal={() => setDeleteOpen(false)}
      deleteWorkspace={handleDeleteWorkspace}
      createWorkspace={handleCreateWorkspace}
    />
  );
};
