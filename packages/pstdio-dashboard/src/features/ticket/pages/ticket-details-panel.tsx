import { useNavigate, useParams } from "@tanstack/react-router";
import { ShellWorkbench } from "pstdio-shell/react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useProject } from "@/features/project/hooks/use-project";
import { useArchiveSession } from "@/features/sessions/hooks/use-archive-session";
import { buildSessionOverflowActions } from "@/features/sessions/session-actions";
import { uploadTicketFile } from "@/features/ticket-list/data/api";
import { useCreateTicketAttempt } from "@/features/ticket-list/hooks/use-create-ticket-attempt";
import {
  useDeleteProjectTicket,
  useProjectTickets,
  useUpdateProjectTicket,
  useUpdateProjectTicketTags,
} from "@/features/ticket-list/hooks/use-project-tickets";
import {
  shouldFetchTicketAttemptDiff,
  useTicketAttemptDiffs,
} from "@/features/ticket-list/hooks/use-ticket-attempt-diffs";
import { useAttemptStatusMap } from "@/features/workspaces/hooks/use-attempt-status-map";
import { useDeleteWorkspace } from "@/features/workspaces/hooks/use-workspace-actions";
import { useWorkspaceSessions } from "@/features/workspaces/hooks/use-workspace-sessions";
import { buildWorkspaceDeleteOverflowAction } from "@/features/workspaces/pages/workspace-page-actions";
import {
  createDashboardTicketDetailsShell,
  type DashboardTicketDetailsNavigationState,
} from "@/shared/shell/dashboard-ticket-details-shell";
import { TicketDetailsPanelDialogs } from "@/shared/shell/ticket-details/ticket-details-panel-dialogs";
import { useTicketDetailsNavigationActions } from "@/shared/shell/ticket-details/use-ticket-details-navigation-actions";
import { useTicketDetailsSessionActions } from "@/shared/shell/ticket-details/use-ticket-details-session-actions";
import { useTicketDetailsShellRenderers } from "@/shared/shell/ticket-details/use-ticket-details-shell-renderers";
import { useShell } from "@/shared/shell/use-shell";
import { useProjectSettingsStore } from "@/shared/stores/project-settings";
import { useContentAutosave } from "../hooks/use-content-autosave";
import { useTicketContent } from "../hooks/use-ticket-content";
import { useTicketFiles } from "../hooks/use-ticket-files";
import { resolveParentTicketReference } from "../utils/resolve-parent-ticket-reference";
import { resolveSidebarSubTickets } from "../utils/sidebar-sub-tickets";
import { isTicketContentReady } from "../utils/ticket-content-ready";
import { resolveTicketDetailsState } from "../utils/ticket-details-state";
import {
  buildSelectableTicketFiles,
  isImageFileName,
  resolveSelectedTicketFile,
  TICKET_CONTENT_ITEM_ID,
} from "../utils/ticket-file-selection";
import { buildTicketBreadcrumbs, buildTicketOverflowActions } from "./ticket-details-actions";

interface TicketDetailsPanelContentProps {
  projectId?: string;
  selectedFileId?: string;
  ticketShorthand?: string;
}

const resolveStatusMessage = (state: string, hasTicket: boolean, t: (key: string) => string) => {
  if (state === "loading") return t("tickets:ticketDetail.loadingContent");
  return hasTicket ? null : t("tickets:ticketDetail.ticketNotFound");
};

const createTicketDetailsContextMenuActionResolvers = (input: {
  archiveSession: ReturnType<typeof useArchiveSession>;
  deleteWorkspace: ReturnType<typeof useDeleteWorkspace>;
  setWorkspaceToDeleteId: (workspaceId: string | null) => void;
  t: (key: string) => string;
}) => {
  const { archiveSession, deleteWorkspace, setWorkspaceToDeleteId, t } = input;

  return {
    resolveSessionContextDefaultActions: (session: { id: string; agentSessionId?: string | null }) =>
      buildSessionOverflowActions({
        sessionId: session.id,
        agentSessionId: session.agentSessionId,
        onArchive: () => archiveSession.mutate(session.id),
        t,
      }),
    resolveWorkspaceContextDefaultActions: (workspace: { id: string }) =>
      buildWorkspaceDeleteOverflowAction({
        t,
        hasSelectedWorkspace: true,
        isMutationPending: deleteWorkspace.isPending,
        onDeleteWorkspace: () => setWorkspaceToDeleteId(workspace.id),
      }),
  };
};

const createAttemptDiffInputs = (
  workspaces: Array<{ id: string } & Parameters<typeof shouldFetchTicketAttemptDiff>[0]>,
) => workspaces.map((attempt) => ({ workspaceId: attempt.id, shouldFetch: shouldFetchTicketAttemptDiff(attempt) }));

const createEmptyTicketDetailsNavigationState = () =>
  ({ getSections: () => [], openResource: () => undefined }) satisfies DashboardTicketDetailsNavigationState;

const TicketDetailsPanelContent = (props: TicketDetailsPanelContentProps) => {
  const { projectId, selectedFileId, ticketShorthand } = props;
  const navigate = useNavigate();
  const { t } = useTranslation(["projects", "tickets"]);
  const { pluginActionTrigger, workspaceActionTrigger, sessionActionTrigger, openSessionBubble, setSelectedSessionId } =
    useTicketDetailsSessionActions(projectId);

  const { data: project } = useProject(projectId);
  const { data: allTickets, isLoading: isTicketsLoading } = useProjectTickets(projectId);
  const createAttempt = useCreateTicketAttempt(projectId);
  const updateTicket = useUpdateProjectTicket(projectId);
  const updateTicketTags = useUpdateProjectTicketTags(projectId);
  const deleteTicket = useDeleteProjectTicket(projectId);
  const deleteWorkspace = useDeleteWorkspace();
  const archiveSession = useArchiveSession();
  const allProjectTickets = allTickets ?? [];
  const ticketState = resolveTicketDetailsState({ tickets: allTickets, ticketShorthand, isTicketsLoading });
  const ticket = ticketState.ticket;
  const parentReference = resolveParentTicketReference(allProjectTickets, ticket?.parentId);
  const ticketId = ticket?.id ?? "";
  const sidebarSubTickets = ticket ? resolveSidebarSubTickets(allProjectTickets, ticket.id, ticket.shorthand) : [];
  const ticketFiles = useTicketFiles(ticket?.id);
  const selectableFiles = buildSelectableTicketFiles(ticketFiles.data);
  const selectedFile = resolveSelectedTicketFile(selectableFiles, selectedFileId);
  const isImageFile = isImageFileName(selectedFile.fileName);
  const ticketContent = useTicketContent(ticket?.id, selectedFile.id, { enabled: !isImageFile });
  const workspaces = ticket?.attempts ?? [];
  const attemptDiffInputs = createAttemptDiffInputs(workspaces);
  const { diffTotalsByWorkspaceId } = useTicketAttemptDiffs(attemptDiffInputs);
  const attemptStatusMap = useAttemptStatusMap(projectId);
  const workspaceSessions = useWorkspaceSessions(workspaces.map((w) => w.id));
  const sessionsByWorkspaceId = workspaceSessions.sessionsByWorkspaceId;
  const content = ticketContent.data ?? "";
  const isContentReady = isTicketContentReady(ticketContent.data, ticketContent.isLoading);
  const [isDetailsPanelOpen, setIsDetailsPanelOpen] = useState(true);
  const [isCreateWorkspaceOpen, setCreateWorkspaceOpen] = useState(false);
  const [isDeleteOpen, setDeleteOpen] = useState(false);
  const [workspaceToDeleteId, setWorkspaceToDeleteId] = useState<string | null>(null);
  const lastSelectedBranches = useProjectSettingsStore((state) => state.lastSelectedBranches);
  const lastSelectedRepo = useProjectSettingsStore((state) => state.lastSelectedRepo);
  const resolvedProjectId = projectId ?? "";
  const resolvedTicketShorthand = ticketShorthand ?? "ticket";
  const navigationRef = useRef(createEmptyTicketDetailsNavigationState());
  const ticketDetailsShell = useShell(() =>
    createDashboardTicketDetailsShell({
      projectId: resolvedProjectId,
      projectName: project?.name ?? "Project",
      ticketShorthand: resolvedTicketShorthand,
      ticketTitle: ticket?.title,
      navigation: navigationRef,
      navigate: (path) => navigate({ to: path }),
    }),
  );

  const autosave = useContentAutosave({
    scopeKey: ticketId ? `ticket:${ticketId}:${selectedFile.id}` : "ticket:none",
    saveTargetId: selectedFile.id,
    content,
    onSave: async (id, nextContent) => {
      ticketContent.setOptimisticContent(nextContent);
      if (id === TICKET_CONTENT_ITEM_ID) {
        await updateTicket.mutateAsync({ ticketId, content: nextContent });
        return;
      }
      const attachment = selectableFiles.find((file) => file.id === id);
      if (!attachment) return;
      await uploadTicketFile(
        ticketId,
        new File([nextContent], attachment.fileName, {
          type: attachment.fileName.endsWith(".md") ? "text/markdown" : "text/plain",
        }),
      );
    },
  });

  const statusMessage = resolveStatusMessage(ticketState.state, Boolean(ticket), t);

  const defaultOverflowActions = ticket
    ? buildTicketOverflowActions({
        ticket,
        projectId,
        updateTicket,
        deleteTicket,
        onDeleteOpen: () => setDeleteOpen(true),
        t,
      })
    : [];

  const breadcrumbs = ticket
    ? buildTicketBreadcrumbs({
        ticketShorthand: ticket.shorthand,
        ticketTitle: ticket.title,
        parentShorthand: parentReference.shorthand,
        parentTitle: parentReference.ticket?.title ?? null,
        projectId: resolvedProjectId,
      })
    : [];
  const {
    navigateBack,
    handleSelectTicket,
    handleSelectFile,
    handleSelectSubTicket,
    handleSelectWorkspace,
    handleSelectWorkspaceSession,
    handleCreateEmptyWorkspace,
    handleConfirmDeleteTicket,
    handleConfirmDeleteWorkspace,
  } = useTicketDetailsNavigationActions({
    allProjectTickets,
    autosave,
    createAttempt,
    deleteTicket,
    deleteWorkspace,
    lastSelectedBranches,
    lastSelectedRepo,
    navigate,
    openSessionBubble,
    project,
    projectId,
    sessionsByWorkspaceId,
    setDeleteOpen,
    setSelectedSessionId,
    setWorkspaceToDeleteId,
    ticket,
    workspaceToDeleteId,
    workspaces,
  });
  const contextMenuActions = createTicketDetailsContextMenuActionResolvers({
    archiveSession,
    deleteWorkspace,
    setWorkspaceToDeleteId,
    t,
  });

  useTicketDetailsShellRenderers({
    allProjectTickets,
    attemptStatusMap,
    autoSaveEditorKey: autosave.editorKey,
    autoSaveInitialContent: autosave.initialContent,
    breadcrumbs,
    defaultOverflowActions,
    diffTotalsByWorkspaceId,
    isContentReady,
    isDetailsPanelOpen,
    isImageFile,
    navigation: navigationRef,
    pluginActionTrigger,
    project,
    projectId,
    resolvedProjectId,
    selectableFiles,
    selectedFile,
    sessionActionTrigger,
    sessionsByWorkspaceId,
    shell: ticketDetailsShell,
    sidebarSubTickets,
    statusMessage,
    ticket,
    ticketId,
    updateTicketTags,
    workspaceActionTrigger,
    workspaces,
    resolveSessionContextDefaultActions: contextMenuActions.resolveSessionContextDefaultActions,
    resolveWorkspaceContextDefaultActions: contextMenuActions.resolveWorkspaceContextDefaultActions,
    onCreateWorkspace: () => setCreateWorkspaceOpen(true),
    onEditorChange: autosave.handleChange,
    onPluginAction: (actionKey, targetTicketId) => void pluginActionTrigger.trigger(actionKey, targetTicketId),
    onSelectFile: handleSelectFile,
    onSelectPlanning: () => void navigateBack(),
    onSelectSession: handleSelectWorkspaceSession,
    onSelectSubTicket: handleSelectSubTicket,
    onSelectTicket: handleSelectTicket,
    onSelectWorkspace: handleSelectWorkspace,
    onTagIdsChange: (ids) => {
      if (!ticket) return;
      updateTicketTags.mutate({ ticketId: ticket.id, tagIds: ids });
    },
    onToggleDetailsPanel: () => setIsDetailsPanelOpen(!isDetailsPanelOpen),
    placeholder: t("tickets:ticketDetail.enterDescription"),
  });

  return (
    <>
      <ShellWorkbench shell={ticketDetailsShell} />
      <TicketDetailsPanelDialogs
        attemptCount={workspaces.length}
        isCreateWorkspaceOpen={isCreateWorkspaceOpen}
        isCreateWorkspaceSubmitting={createAttempt.isPending}
        isDeleteOpen={isDeleteOpen}
        pluginActionTrigger={pluginActionTrigger}
        projectId={projectId}
        sessionActionTrigger={sessionActionTrigger}
        workspaceActionTrigger={workspaceActionTrigger}
        workspaceToDeleteId={workspaceToDeleteId}
        onCloseCreateWorkspace={() => setCreateWorkspaceOpen(false)}
        onCloseDeleteTicket={() => setDeleteOpen(false)}
        onCloseDeleteWorkspace={() => setWorkspaceToDeleteId(null)}
        onConfirmCreateWorkspace={handleCreateEmptyWorkspace}
        onConfirmDeleteTicket={handleConfirmDeleteTicket}
        onConfirmDeleteWorkspace={handleConfirmDeleteWorkspace}
      />
    </>
  );
};

export const TicketDetailsPanel = () => {
  const { projectId, selectedFileId, ticketShorthand } = useParams({ strict: false });

  return (
    <TicketDetailsPanelContent
      key={`${projectId ?? "project"}:${ticketShorthand ?? "ticket"}`}
      projectId={projectId}
      selectedFileId={selectedFileId}
      ticketShorthand={ticketShorthand}
    />
  );
};
