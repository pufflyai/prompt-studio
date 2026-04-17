import type { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import type { useProject } from "@/features/project/hooks/use-project";
import { buildImplementTicketPrompt } from "@/features/ticket/utils/build-prompts";
import type { useCreateTicketAttempt } from "@/features/ticket-list/hooks/use-create-ticket-attempt";
import type { useProjectTickets } from "@/features/ticket-list/hooks/use-project-tickets";
import { logMutationError } from "@/lib/error-handlers";
import type { WorkspaceListItem } from "../components/workspace-list-panel";
import type { useAttemptStatusMap } from "../hooks/use-attempt-status-map";
import type { useDeleteWorkspace } from "../hooks/use-workspace-actions";
import { runWorkspaceDeleteFlow } from "./workspace-page-actions";
import { resolveWorkspacePageSessionSearch } from "./workspace-page-session-search";
import type { WorkspacePageTab } from "./workspace-page-tab";

export const buildWorkspaceListItems = (
  attempts: NonNullable<ReturnType<typeof useProjectTickets>["data"]>[number]["attempts"],
  attemptStatusMap: ReturnType<typeof useAttemptStatusMap>,
): WorkspaceListItem[] =>
  attempts.map((attempt) => {
    const status = attempt.attemptStatusId ? attemptStatusMap.get(attempt.attemptStatusId) : undefined;

    return {
      id: attempt.id,
      label: attempt.label,
      shorthand: attempt.shorthand,
      updatedAt: attempt.updatedAt,
      worktreePath: attempt.worktreePath,
      setupError: attempt.setupError,
      attemptStatusName: status?.name,
      attemptStatusColor: status?.color,
    };
  });

export const runWorkspaceAttempt = async (input: {
  ticket: NonNullable<ReturnType<typeof useProjectTickets>["data"]>[number] | null;
  projectId: string | undefined;
  project: ReturnType<typeof useProject>["data"];
  createAttempt: ReturnType<typeof useCreateTicketAttempt>;
  lastSelectedAgent: string | null;
  lastSelectedModels: string[];
  lastSelectedBranches: string[];
  lastSelectedRepo: string;
  onSuccess: (workspaceShorthand: string) => void;
}) => {
  const { ticket, projectId, project, createAttempt, lastSelectedAgent, lastSelectedModels, lastSelectedBranches } =
    input;

  if (!ticket || !projectId || createAttempt.isPending) return false;

  const prompt = buildImplementTicketPrompt(ticket.shorthand);
  const repoId = input.lastSelectedRepo || project?.repositories[0]?.id || null;
  const branch = lastSelectedBranches[0]?.trim() ? lastSelectedBranches[0] : null;
  const model = lastSelectedModels[0]?.trim() ? lastSelectedModels[0] : null;

  try {
    const result = await createAttempt.mutateAsync({
      ticketId: ticket.id,
      agent: lastSelectedAgent,
      repoId,
      branch,
      model,
      prompt,
    });

    input.onSuccess(result.workspaceShorthand);
    return true;
  } catch (error) {
    logMutationError("run attempt", error);
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
