import type { useNavigate } from "@tanstack/react-router";
import type { useProject } from "@/features/project/hooks/use-project";
import { buildWorkspaceRoute } from "@/features/ticket/pages/ticket-details-actions";
import { TICKET_CONTENT_ITEM_ID } from "@/features/ticket/utils/ticket-file-selection";
import type { useCreateTicketAttempt } from "@/features/ticket-list/hooks/use-create-ticket-attempt";
import type { useDeleteProjectTicket } from "@/features/ticket-list/hooks/use-project-tickets";
import type { Ticket } from "@/features/ticket-list/types";
import type { useDeleteWorkspace } from "@/features/workspaces/hooks/use-workspace-actions";
import type { useWorkspaceSessions } from "@/features/workspaces/hooks/use-workspace-sessions";
import { navigateToCreatedWorkspace, runWorkspaceCreation } from "@/features/workspaces/pages/workspace-page-helpers";
import { resolveWorkspaceSelection } from "@/features/workspaces/utils/workspace-selection";

interface UseTicketDetailsNavigationActionsInput {
  allProjectTickets: Ticket[];
  autosave: { flushPending: () => Promise<void> };
  createAttempt: ReturnType<typeof useCreateTicketAttempt>;
  deleteTicket: ReturnType<typeof useDeleteProjectTicket>;
  deleteWorkspace: ReturnType<typeof useDeleteWorkspace>;
  lastSelectedBranches: string[];
  lastSelectedRepo: string;
  navigate: ReturnType<typeof useNavigate>;
  openSessionBubble: (sessionId: string | null | undefined) => void;
  project: ReturnType<typeof useProject>["data"];
  projectId?: string;
  sessionsByWorkspaceId: ReturnType<typeof useWorkspaceSessions>["sessionsByWorkspaceId"];
  setDeleteOpen: (open: boolean) => void;
  setSelectedSessionId: (sessionId: string | null) => void;
  setWorkspaceToDeleteId: (workspaceId: string | null) => void;
  ticket: Ticket | null | undefined;
  workspaceToDeleteId: string | null;
  workspaces: Ticket["attempts"];
}

export const useTicketDetailsNavigationActions = (input: UseTicketDetailsNavigationActionsInput) => {
  const {
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
    workspaces = [],
  } = input;

  const navigateBack = async () => {
    await autosave.flushPending();
    navigate({ to: "/projects/$projectId/tickets", params: { projectId } });
  };

  const handleSelectTicket = (id: string) => {
    const target = allProjectTickets.find((item) => item.id === id);
    if (!target) return;
    navigate({
      to: "/projects/$projectId/tickets/$ticketShorthand",
      params: { projectId, ticketShorthand: target.shorthand },
    });
  };

  const handleSelectFile = async (fileId: string) => {
    if (!ticket) return;
    await autosave.flushPending();
    if (fileId === TICKET_CONTENT_ITEM_ID) {
      navigate({
        to: "/projects/$projectId/tickets/$ticketShorthand",
        params: { projectId, ticketShorthand: ticket.shorthand },
      });
      return;
    }
    navigate({
      to: "/projects/$projectId/tickets/$ticketShorthand/files/$selectedFileId",
      params: { projectId, ticketShorthand: ticket.shorthand, selectedFileId: fileId },
    });
  };

  const handleSelectSubTicket = async (subTicketShorthand: string) => {
    await autosave.flushPending();
    navigate({
      to: "/projects/$projectId/tickets/$ticketShorthand",
      params: { projectId, ticketShorthand: subTicketShorthand },
    });
  };

  const handleSelectWorkspace = (workspaceShorthand: string) => {
    if (!projectId || !ticket) return;
    const workspace = workspaces.find((item) => item.shorthand === workspaceShorthand);
    const workspaceSessionsList = workspace ? (sessionsByWorkspaceId.get(workspace.id) ?? []) : [];
    const selection = resolveWorkspaceSelection({ sessions: workspaceSessionsList });
    navigate({
      ...buildWorkspaceRoute(projectId, ticket.shorthand, workspaceShorthand),
      search: selection.search,
    });
    if (selection.shouldClearSelection) {
      setSelectedSessionId(null);
      return;
    }
    openSessionBubble(selection.sessionIdToOpen);
  };

  const handleSelectWorkspaceSession = (workspaceShorthand: string, sessionId: string) => {
    if (!projectId || !ticket) return;
    navigate({
      ...buildWorkspaceRoute(projectId, ticket.shorthand, workspaceShorthand),
      search: sessionId ? { sessionId } : {},
    });
  };

  const handleCreateEmptyWorkspace = () => {
    if (!ticket) return false;
    return runWorkspaceCreation({
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
          ticketShorthand: ticket.shorthand,
          workspaceShorthand: result.workspaceShorthand,
        });
      },
    });
  };

  const handleConfirmDeleteTicket = async () => {
    if (!ticket) return;
    await deleteTicket.mutateAsync({ ticketId: ticket.id });
    setDeleteOpen(false);
    await navigateBack();
  };

  const handleConfirmDeleteWorkspace = async () => {
    if (!workspaceToDeleteId) return;
    await deleteWorkspace.mutateAsync({ workspaceId: workspaceToDeleteId });
    setWorkspaceToDeleteId(null);
  };

  return {
    navigateBack,
    handleSelectTicket,
    handleSelectFile,
    handleSelectSubTicket,
    handleSelectWorkspace,
    handleSelectWorkspaceSession,
    handleCreateEmptyWorkspace,
    handleConfirmDeleteTicket,
    handleConfirmDeleteWorkspace,
  };
};
