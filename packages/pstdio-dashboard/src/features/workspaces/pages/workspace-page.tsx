import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { ShellWorkbench } from "pstdio-shell/react";
import { useEffect, useRef, useState } from "react";
import { usePluginActionTrigger } from "@/features/plugin-actions/hooks/use-plugin-action-trigger";
import { useProject } from "@/features/project/hooks/use-project";
import { useTicketAttemptDiff } from "@/features/ticket/hooks/use-ticket-attempt-diff";
import { useTicketFiles } from "@/features/ticket/hooks/use-ticket-files";
import { openTicketSessionBubble } from "@/features/ticket/utils/open-ticket-session-bubble";
import { resolveSidebarSubTickets } from "@/features/ticket/utils/sidebar-sub-tickets";
import { buildSelectableTicketFiles, TICKET_CONTENT_ITEM_ID } from "@/features/ticket/utils/ticket-file-selection";
import { useCreateTicketAttempt } from "@/features/ticket-list/hooks/use-create-ticket-attempt";
import { useDeleteProjectTicket, useProjectTickets } from "@/features/ticket-list/hooks/use-project-tickets";
import {
  shouldFetchTicketAttemptDiff,
  useTicketAttemptDiffs,
} from "@/features/ticket-list/hooks/use-ticket-attempt-diffs";
import { transformFileDiffs } from "@/features/workspaces/utils/transform-diff";
import { useWorkspaceShell } from "@/shared/shell/workspace/use-workspace-shell";
import { useProjectSettingsStore, useProjectSettingsStoreApi } from "@/shared/stores/project-settings";
import { useAttemptStatusMap } from "../hooks/use-attempt-status-map";
import { useDeleteWorkspace } from "../hooks/use-workspace-actions";
import { useWorkspaceSessions } from "../hooks/use-workspace-sessions";
import { resolveActiveWorkspaceSessionId } from "../utils/selected-workspace-session";
import { resolveWorkspaceSelection } from "../utils/workspace-selection";
import { resolveWorkspacePageAutoOpenSession } from "./workspace-page-auto-open-session";
import {
  buildWorkspaceListItems,
  navigateToCreatedWorkspace,
  navigateToProjectTickets,
  navigateToTicketDetails,
  runDeleteWorkspaceFlow,
  runWorkspaceCreation,
  useWorkspaceSessionSearchNormalization,
} from "./workspace-page-helpers";
import { shouldShowWorkspaceTicketNotFound } from "./workspace-page-readiness";
import { normalizeWorkspacePageTab } from "./workspace-page-tab";
import { WorkspacePageTicketNotFound } from "./workspace-page-ticket-not-found";

// biome-ignore lint/complexity: This page coordinates route state, multiple action triggers, and modal flows for the workspace surface.
export const WorkspacePage = () => {
  const { projectId, ticketShorthand, workspaceShorthand } = useParams({ strict: false });
  const search = useSearch({ strict: false });
  const sessionId = typeof search.sessionId === "string" ? search.sessionId : undefined;
  const requestedTab = typeof search.tab === "string" ? search.tab : undefined;
  const activeTab = normalizeWorkspacePageTab(search.tab);
  const navigate = useNavigate();
  const [isCreateWorkspaceModalOpen, setIsCreateWorkspaceModalOpen] = useState(false);
  const [isDeleteOpen, setDeleteOpen] = useState(false);
  const [isTicketDeleteOpen, setTicketDeleteOpen] = useState(false);
  const projectSettingsStore = useProjectSettingsStoreApi();
  const setSessionModalState = useProjectSettingsStore((state) => state.setSessionModalState);
  const setSelectedSessionId = useProjectSettingsStore((state) => state.setSelectedSessionId);
  const lastAutoOpenedRouteKeyRef = useRef<string | null>(null);
  const { data: project } = useProject(projectId);
  const ticketsQuery = useProjectTickets(projectId);
  const allTickets = ticketsQuery.data ?? [];
  const ticket = allTickets.find((item) => item.shorthand === ticketShorthand) ?? null;
  const sidebarSubTickets = ticket ? resolveSidebarSubTickets(allTickets, ticket.id, ticket.shorthand) : [];
  const attempts = ticket?.attempts ?? [];
  const attemptStatusMap = useAttemptStatusMap(projectId);
  const createAttempt = useCreateTicketAttempt(projectId);
  const deleteWorkspace = useDeleteWorkspace();
  const deleteTicket = useDeleteProjectTicket(projectId);
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

  const handleSelectFile = (fileId: string) => {
    if (!projectId || !ticketShorthand) return;

    if (fileId === TICKET_CONTENT_ITEM_ID) {
      void navigateToTicketDetails(navigate, projectId, ticketShorthand);
      return;
    }

    void navigate({
      to: "/projects/$projectId/tickets/$ticketShorthand/files/$selectedFileId",
      params: { projectId, ticketShorthand, selectedFileId: fileId },
    });
  };

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

  const handleDeleteTicket = async () => {
    if (!ticket) return;

    await deleteTicket.mutateAsync({ ticketId: ticket.id });
    setTicketDeleteOpen(false);
    navigateToProjectTickets(navigate, projectId);
  };

  const workspaceShell = useWorkspaceShell({
    activeSessionId,
    activeTab,
    artifacts,
    attemptStatusMap,
    attempts,
    changedFiles,
    createAttemptIsPending: createAttempt.isPending,
    diffGeneration: diffQuery.dataUpdatedAt,
    diffTotalsByWorkspaceId,
    diffs,
    isCreateWorkspaceModalOpen,
    isDeleteOpen,
    isDiffLoading,
    isTicketDeleteOpen,
    navigate,
    pluginActionTrigger,
    project,
    projectId,
    selectableFiles,
    selectedWorkspace,
    selectedWorkspaceLabel,
    sessionActionTrigger,
    sessionId,
    sessionsByWorkspaceId,
    sidebarSubTickets,
    ticket,
    ticketActionTrigger,
    ticketShorthand,
    workspaceShorthand,
    closeCreateWorkspaceModal: () => setIsCreateWorkspaceModalOpen(false),
    closeDeleteModal: () => setDeleteOpen(false),
    closeTicketDeleteModal: () => setTicketDeleteOpen(false),
    createEmptyWorkspace: handleCreateEmptyWorkspace,
    createWorkspace: handleCreateWorkspace,
    deleteTicket: handleDeleteTicket,
    deleteWorkspace: handleDeleteWorkspace,
    deleteWorkspaceIsPending: deleteWorkspace.isPending,
    onPluginAction: (actionKey, workspaceId) => void pluginActionTrigger.trigger(actionKey, workspaceId),
    openDeleteModal: () => setDeleteOpen(true),
    selectFile: handleSelectFile,
    selectSession: handleSelectSession,
    selectSubTicket: handleSelectSubTicket,
    selectWorkspace: handleSelectWorkspace,
  });

  if (!ticket) {
    return shouldShowWorkspaceTicketNotFound({ hasTicket: false, areTicketsLoading: ticketsQuery.isLoading }) ? (
      <WorkspacePageTicketNotFound />
    ) : (
      <ShellWorkbench shell={workspaceShell} />
    );
  }

  return <ShellWorkbench shell={workspaceShell} />;
};
