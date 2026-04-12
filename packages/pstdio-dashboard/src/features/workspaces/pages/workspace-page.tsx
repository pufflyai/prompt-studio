import { Stack, Text } from "@chakra-ui/react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { usePluginActionTrigger } from "@/features/plugin-actions/hooks/use-plugin-action-trigger";
import { useProject } from "@/features/project/hooks/use-project";
import { useProjectSettingsStore, useProjectSettingsStoreApi } from "@/features/project-settings/store";
import { useTicketAttemptDiff } from "@/features/ticket/hooks/use-ticket-attempt-diff";
import { useTicketFiles } from "@/features/ticket/hooks/use-ticket-files";
import { buildImplementTicketPrompt } from "@/features/ticket/utils/build-prompts";
import { openTicketSessionBubble } from "@/features/ticket/utils/open-ticket-session-bubble";
import { buildSelectableTicketFiles } from "@/features/ticket/utils/ticket-file-selection";
import { useCreateTicketAttempt } from "@/features/ticket-list/hooks/use-create-ticket-attempt";
import { useProjectTickets } from "@/features/ticket-list/hooks/use-project-tickets";
import { isSessionSettled } from "@/features/ticket-list/utils/ticket-attempts";
import { transformFileDiffs } from "@/features/workspaces/utils/transform-diff";
import { logMutationError } from "@/lib/error-handlers";
import type { WorkspaceListItem } from "../components/workspace-list-panel";
import { WorkspacePageContent } from "../components/workspace-page-content";
import { useAttemptStatusMap } from "../hooks/use-attempt-status-map";
import { useArchiveWorkspace, useDeleteWorkspace } from "../hooks/use-workspace-mutations";
import { useWorkspaceSessions } from "../hooks/use-workspace-sessions";

const buildWorkspaceListItems = (
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

const runWorkspaceAttempt = async (input: {
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

export const WorkspacePage = () => {
  const { projectId, ticketShorthand, workspaceShorthand } = useParams({ strict: false });
  const navigate = useNavigate();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const projectSettingsStore = useProjectSettingsStoreApi();
  const setSessionModalState = useProjectSettingsStore((state) => state.setSessionModalState);
  const setSelectedSessionId = useProjectSettingsStore((state) => state.setSelectedSessionId);

  const { data: project } = useProject(projectId);
  const { data: allTickets = [] } = useProjectTickets(projectId);
  const ticket = allTickets.find((item) => item.shorthand === ticketShorthand) ?? null;
  const attempts = ticket?.attempts ?? [];
  const attemptStatusMap = useAttemptStatusMap(projectId);
  const createAttempt = useCreateTicketAttempt(projectId);
  const archiveWorkspace = useArchiveWorkspace(projectId);
  const deleteWorkspace = useDeleteWorkspace(projectId);
  const lastSelectedAgent = useProjectSettingsStore((state) => state.lastSelectedAgent);
  const lastSelectedModels = useProjectSettingsStore((state) => state.lastSelectedModels);
  const lastSelectedBranches = useProjectSettingsStore((state) => state.lastSelectedBranches);
  const lastSelectedRepo = useProjectSettingsStore((state) => state.lastSelectedRepo);
  const workspaces = buildWorkspaceListItems(attempts, attemptStatusMap);

  const workspaceIds = workspaces.map((workspace) => workspace.id);
  const sessionsByWorkspaceId = useWorkspaceSessions(workspaceIds);
  const selectedWorkspace = workspaces.find((workspace) => workspace.shorthand === workspaceShorthand) ?? null;
  const selectedAttempt = attempts.find((attempt) => attempt.shorthand === workspaceShorthand) ?? null;
  const selectedWorkspaceLabel = selectedWorkspace?.shorthand ?? workspaceShorthand ?? "";
  const sessionSettled = isSessionSettled(selectedAttempt?.sessionStatus ?? null);

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

  const { data: diffData } = useTicketAttemptDiff(selectedWorkspace?.id, { enabled: sessionSettled });
  const diffs = diffData?.files ? transformFileDiffs(diffData.files) : [];

  const ticketFiles = useTicketFiles(ticket?.id);
  const selectableFiles = buildSelectableTicketFiles(ticketFiles.data);
  const artifacts = ticketFiles.data?.artifacts ?? [];

  const handleSelectWorkspace = (nextWorkspaceShorthand: string) => {
    if (!projectId || !ticketShorthand) return;
    navigate({
      to: "/projects/$projectId/tickets/$ticketShorthand/workspaces/$workspaceShorthand",
      params: { projectId, ticketShorthand, workspaceShorthand: nextWorkspaceShorthand },
    });
  };

  const handleSelectSession = (_workspaceShorthand: string, sessionId: string) => {
    openTicketSessionBubble({
      sessionId,
      sessionModalState: projectSettingsStore.getState().sessionModalState,
      setSessionModalState,
      setSelectedSessionId,
    });
  };

  const handleSelectFile = () => {
    if (!projectId || !ticketShorthand) return;
    navigate({
      to: "/projects/$projectId/tickets/$ticketShorthand",
      params: { projectId, ticketShorthand },
    });
  };

  const handleRunAttempt = async () => {
    return runWorkspaceAttempt({
      ticket,
      projectId,
      project,
      createAttempt,
      lastSelectedAgent,
      lastSelectedModels,
      lastSelectedBranches,
      lastSelectedRepo,
      onSuccess: (ws) => handleSelectWorkspace(ws),
    });
  };

  const handleArchiveWorkspace = async () => {
    if (!selectedWorkspace) return;

    try {
      await archiveWorkspace.mutateAsync({ workspaceId: selectedWorkspace.id });
    } catch (error) {
      logMutationError("archive workspace", error);
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!selectedWorkspace || !projectId || !ticketShorthand) return;

    try {
      await deleteWorkspace.mutateAsync({ workspaceId: selectedWorkspace.id });
      setIsDeleteOpen(false);
      await navigate({
        to: "/projects/$projectId/tickets/$ticketShorthand",
        params: { projectId, ticketShorthand },
      });
    } catch (error) {
      logMutationError("delete workspace", error);
    }
  };

  const pendingActionKey = archiveWorkspace.isPending
    ? "archive-workspace"
    : deleteWorkspace.isPending
      ? "delete-workspace"
      : pluginActionTrigger.pendingActionKey;
  const isExecutingActions = pluginActionTrigger.isExecuting || archiveWorkspace.isPending || deleteWorkspace.isPending;

  if (!ticket) {
    return (
      <Stack gap="lg" height="100%" p="sm">
        <Text textStyle="paragraph/S/regular" color="foreground.secondary">
          Ticket not found.
        </Text>
      </Stack>
    );
  }

  return (
    <WorkspacePageContent
      projectId={projectId}
      ticketShorthand={ticketShorthand}
      ticket={ticket}
      attemptStatusMap={attemptStatusMap}
      selectedWorkspaceLabel={selectedWorkspaceLabel}
      selectedWorkspace={selectedWorkspace}
      sessionsByWorkspaceId={sessionsByWorkspaceId}
      diffs={diffs}
      artifacts={artifacts}
      attempts={attempts}
      selectableFiles={selectableFiles}
      createAttemptIsPending={createAttempt.isPending}
      selectWorkspace={handleSelectWorkspace}
      selectSession={handleSelectSession}
      selectFile={handleSelectFile}
      isCreateModalOpen={isCreateModalOpen}
      closeCreateModal={() => setIsCreateModalOpen(false)}
      runAttempt={handleRunAttempt}
      archiveWorkspace={handleArchiveWorkspace}
      deleteWorkspace={handleDeleteWorkspace}
      isDeleteOpen={isDeleteOpen}
      openDeleteModal={() => setIsDeleteOpen(true)}
      closeDeleteModal={() => setIsDeleteOpen(false)}
      pendingActionKey={pendingActionKey}
      isExecutingActions={isExecutingActions}
      pluginActions={selectedWorkspace ? pluginActionTrigger.pluginActions : []}
      pluginActionTrigger={pluginActionTrigger}
    />
  );
};
