import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
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
import {
  headerActionsToResourceContextActions,
  toSidebarContextMenuItems,
} from "@/shared/extensions/context-menu-actions";
import { useExtensionResourceContextMenuActions } from "@/shared/extensions/hooks/use-extension-resource-context-menu-actions";
import { buildTicketExtensionResource } from "@/shared/extensions/resource-context";
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
import { WorkspacePagePendingShell } from "./workspace-page-pending-shell";
import { shouldShowWorkspaceTicketNotFound } from "./workspace-page-readiness";
import { resolveWorkspacePageRouteSessionSelection } from "./workspace-page-session-search";
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
  const { t } = useTranslation(["projects", "tickets"]);
  const [isCreateWorkspaceModalOpen, setIsCreateWorkspaceModalOpen] = useState(false);
  const [isDeleteOpen, setDeleteOpen] = useState(false);
  const [isTicketDeleteOpen, setTicketDeleteOpen] = useState(false);
  const projectSettingsStore = useProjectSettingsStoreApi();
  const setSessionModalState = useProjectSettingsStore((state) => state.setSessionModalState);
  const setSelectedSessionId = useProjectSettingsStore((state) => state.setSelectedSessionId);
  const lastAutoOpenedRouteKeyRef = useRef<string | null>(null);
  const lastSyncedRouteSessionIdRef = useRef<string | null>(null);
  const { data: project } = useProject(projectId);
  const ticketsQuery = useProjectTickets(projectId);
  const allTickets = ticketsQuery.data ?? [];
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
    if (!sessionId) {
      lastSyncedRouteSessionIdRef.current = null;
      return;
    }

    const routeSessionId = resolveWorkspacePageRouteSessionSelection({
      requestedSessionId: sessionId,
      activeSessionId,
      areWorkspaceSessionsReady: workspaceSessions.isReady,
      lastSyncedSessionId: lastSyncedRouteSessionIdRef.current,
    });
    if (!routeSessionId) return;

    lastSyncedRouteSessionIdRef.current = routeSessionId;
    setSelectedSessionId(routeSessionId);
  }, [activeSessionId, sessionId, setSelectedSessionId, workspaceSessions.isReady]);

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

  const ticketContextMenuActions = useExtensionResourceContextMenuActions({
    slotId: ["ticket.headerPrimary", "ticket.headerOverflow"],
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

  const handleDeleteTicket = async () => {
    if (!ticket) return;

    await deleteTicket.mutateAsync({ ticketId: ticket.id });
    setTicketDeleteOpen(false);
    navigateToProjectTickets(navigate, projectId);
  };

  if (!ticket) {
    return shouldShowWorkspaceTicketNotFound({ hasTicket: false, areTicketsLoading: ticketsQuery.isLoading }) ? (
      <WorkspacePageTicketNotFound />
    ) : (
      <WorkspacePagePendingShell
        activeTab={activeTab}
        onTabChange={(tab) =>
          navigateToWorkspaceTab({ navigate, projectId, ticketShorthand, workspaceShorthand, sessionId, tab })
        }
      />
    );
  }

  return (
    <>
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
        diffGeneration={diffQuery.dataUpdatedAt}
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
        resolveTicketContextMenuItems={() =>
          toSidebarContextMenuItems([
            ...ticketContextMenuActions.resolveActions(buildTicketExtensionResource({ projectId, ticket })),
            ...headerActionsToResourceContextActions({
              actions: buildTicketOverflowActions({
                ticket,
                projectId,
                updateTicket,
                deleteTicket,
                onDeleteOpen: () => setTicketDeleteOpen(true),
                t,
              }),
            }),
          ])
        }
        resolveSessionContextMenuItems={(session) =>
          toSidebarContextMenuItems(
            headerActionsToResourceContextActions({
              actions: buildSessionOverflowActions({
                sessionId: session.id,
                agentSessionId: session.agentSessionId,
                onArchive: () => archiveSession.mutate(session.id),
                t,
              }),
            }),
          )
        }
        isTicketDeleteOpen={isTicketDeleteOpen}
        closeTicketDeleteModal={() => setTicketDeleteOpen(false)}
        deleteTicket={handleDeleteTicket}
        deleteWorkspaceIsPending={deleteWorkspace.isPending}
        isDeleteOpen={isDeleteOpen}
        openDeleteModal={() => setDeleteOpen(true)}
        closeDeleteModal={() => setDeleteOpen(false)}
        deleteWorkspace={handleDeleteWorkspace}
        createWorkspace={handleCreateWorkspace}
      />
      {ticketContextMenuActions.paramsDialog}
    </>
  );
};
