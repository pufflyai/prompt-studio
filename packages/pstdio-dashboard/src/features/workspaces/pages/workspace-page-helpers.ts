import type { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import type { useProject } from "@/features/project/hooks/use-project";
import type { CreateTicketAttemptResult } from "@/features/ticket-list/data/api";
import type { useCreateTicketAttempt } from "@/features/ticket-list/hooks/use-create-ticket-attempt";
import { logMutationError } from "@/lib/error-handlers";
import type { WorkspaceListItem } from "../components/workspace-list-panel";
import type { useAttemptStatusMap } from "../hooks/use-attempt-status-map";
import type { useDeleteWorkspace } from "../hooks/use-workspace-actions";
import { runWorkspaceDeleteFlow } from "./workspace-page-actions";
import { resolveWorkspacePageSessionSearch } from "./workspace-page-session-search";
import type { WorkspacePageTab } from "./workspace-page-tab";

type WorkspaceCreationTicket = {
  id: string;
  shorthand: string;
};

export const buildWorkspaceListItems = (
  attempts: {
    id: string;
    label: string;
    shorthand: string;
    updatedAt: string;
    worktreePath?: string | null;
    setupError?: string | null;
    attemptStatusId?: string | null;
  }[],
  attemptStatusMap: ReturnType<typeof useAttemptStatusMap>,
): WorkspaceListItem[] =>
  attempts.map((attempt) => {
    const status = attempt.attemptStatusId ? attemptStatusMap.get(attempt.attemptStatusId) : undefined;

    return {
      id: attempt.id,
      label: attempt.label,
      shorthand: attempt.shorthand,
      updatedAt: attempt.updatedAt,
      worktreePath: attempt.worktreePath ?? null,
      setupError: attempt.setupError ?? null,
      attemptStatusName: status?.name,
      attemptStatusColor: status?.color,
    };
  });

export const navigateToCreatedWorkspace = (input: {
  navigate: ReturnType<typeof useNavigate>;
  setSelectedSessionId: (sessionId: string | null) => void;
  projectId: string | undefined;
  ticketShorthand: string | undefined;
  workspaceShorthand: string;
  tab?: WorkspacePageTab;
}) => {
  const { navigate, setSelectedSessionId, projectId, ticketShorthand, workspaceShorthand, tab } = input;
  if (!projectId || !ticketShorthand) return;

  setSelectedSessionId(null);
  void navigate({
    to: "/projects/$projectId/tickets/$ticketShorthand/workspaces/$workspaceShorthand",
    params: { projectId, ticketShorthand, workspaceShorthand },
    search: tab ? { tab } : {},
  });
};

export const runWorkspaceCreation = async (input: {
  ticket: WorkspaceCreationTicket | null;
  projectId: string | undefined;
  project: ReturnType<typeof useProject>["data"];
  createAttempt: ReturnType<typeof useCreateTicketAttempt>;
  lastSelectedBranches: string[];
  lastSelectedRepo: string;
  onSuccess: (result: CreateTicketAttemptResult) => void;
}) => {
  const { ticket, projectId, project, createAttempt, lastSelectedBranches } = input;

  if (!ticket || !projectId || createAttempt.isPending) return false;

  const repoId = input.lastSelectedRepo || project?.repositories[0]?.id || null;
  const branch = lastSelectedBranches[0]?.trim() ? lastSelectedBranches[0] : null;

  try {
    const result = await createAttempt.mutateAsync({
      ticketId: ticket.id,
      repoId,
      branch,
      prompt: null,
      startSession: false,
    });

    input.onSuccess(result);
    return true;
  } catch (error) {
    logMutationError("create workspace", error);
    return false;
  }
};

export const navigateToTicketDetails = async (
  navigate: ReturnType<typeof useNavigate>,
  projectId: string | undefined,
  ticketShorthand: string | undefined,
) => {
  if (!projectId || !ticketShorthand) return;

  await navigate({
    to: "/projects/$projectId/tickets/$ticketShorthand",
    params: { projectId, ticketShorthand },
  });
};

export const navigateToWorkspaceTab = (input: {
  navigate: ReturnType<typeof useNavigate>;
  projectId: string | undefined;
  ticketShorthand: string | undefined;
  workspaceShorthand: string | undefined;
  sessionId: string | undefined;
  tab: WorkspacePageTab;
}) => {
  const { navigate, projectId, ticketShorthand, workspaceShorthand, sessionId, tab } = input;
  if (!projectId || !ticketShorthand || !workspaceShorthand) return;

  void navigate({
    to: "/projects/$projectId/tickets/$ticketShorthand/workspaces/$workspaceShorthand",
    params: { projectId, ticketShorthand, workspaceShorthand },
    search: sessionId ? { sessionId, tab } : { tab },
    replace: true,
  });
};

export const navigateToProjectTickets = (navigate: ReturnType<typeof useNavigate>, projectId: string | undefined) => {
  if (!projectId) return;
  void navigate({ to: "/projects/$projectId/tickets", params: { projectId } });
};

export const runDeleteWorkspaceFlow = async (input: {
  selectedWorkspaceId: string | null;
  deleteWorkspace: ReturnType<typeof useDeleteWorkspace>;
  navigate: ReturnType<typeof useNavigate>;
  projectId: string | undefined;
  ticketShorthand: string | undefined;
  closeDeleteModal: () => void;
}) => {
  await runWorkspaceDeleteFlow({
    selectedWorkspaceId: input.selectedWorkspaceId,
    deleteWorkspace: async (workspaceId) => {
      await input.deleteWorkspace.mutateAsync({ workspaceId });
    },
    closeDeleteModal: input.closeDeleteModal,
    navigateToTicket: () => navigateToTicketDetails(input.navigate, input.projectId, input.ticketShorthand),
  });
};

export const useWorkspaceSessionSearchNormalization = (input: {
  projectId: string | undefined;
  ticketShorthand: string | undefined;
  workspaceShorthand: string | undefined;
  requestedSessionId: string | undefined;
  requestedTab: string | undefined;
  activeSessionId: string | null;
  areWorkspaceSessionsReady: boolean;
  navigate: ReturnType<typeof useNavigate>;
}) => {
  const {
    projectId,
    ticketShorthand,
    workspaceShorthand,
    requestedSessionId,
    requestedTab,
    activeSessionId,
    areWorkspaceSessionsReady,
    navigate,
  } = input;

  useEffect(() => {
    if (!projectId || !ticketShorthand || !workspaceShorthand) return;

    const normalizedSearch = resolveWorkspacePageSessionSearch({
      requestedSessionId,
      activeSessionId,
      requestedTab,
      areWorkspaceSessionsReady,
    });
    if (!normalizedSearch) return;

    navigate({
      to: "/projects/$projectId/tickets/$ticketShorthand/workspaces/$workspaceShorthand",
      params: { projectId, ticketShorthand, workspaceShorthand },
      search: normalizedSearch,
      replace: true,
    });
  }, [
    activeSessionId,
    areWorkspaceSessionsReady,
    navigate,
    projectId,
    requestedSessionId,
    requestedTab,
    ticketShorthand,
    workspaceShorthand,
  ]);
};
