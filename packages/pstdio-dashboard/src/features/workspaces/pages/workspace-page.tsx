import { Flex, Stack, Text } from "@chakra-ui/react";
import { Breadcrumb, HorizontalMenuStack, PanelLayout } from "@pstdio/ui";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { KanbanSquare } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActionParamsDialog } from "@/features/plugin-actions/components/action-params-dialog";
import { PluginHeaderActions } from "@/features/plugin-actions/components/plugin-header-actions";
import { usePluginActionTrigger } from "@/features/plugin-actions/hooks/use-plugin-action-trigger";
import { useProject } from "@/features/project/hooks/use-project";
import { useProjectSettingsStore, useProjectSettingsStoreApi } from "@/features/project-settings/store";
import { CreateWorkspaceModal } from "@/features/ticket/components/create-workspace-modal";
import { TicketSidebar } from "@/features/ticket/components/ticket-sidebar";
import { useTicketAttemptDiff } from "@/features/ticket/hooks/use-ticket-attempt-diff";
import { useTicketFiles } from "@/features/ticket/hooks/use-ticket-files";
import { buildImplementTicketPrompt } from "@/features/ticket/utils/build-prompts";
import { openTicketSessionBubble } from "@/features/ticket/utils/open-ticket-session-bubble";
import { buildSelectableTicketFiles } from "@/features/ticket/utils/ticket-file-selection";
import type { ApiWorkspaceArtifact } from "@/features/ticket-list/data/api/types";
import { useCreateTicketAttempt } from "@/features/ticket-list/hooks/use-create-ticket-attempt";
import { useProjectTickets } from "@/features/ticket-list/hooks/use-project-tickets";
import { isSessionSettled } from "@/features/ticket-list/utils/ticket-attempts";
import { transformFileDiffs } from "@/features/workspaces/utils/transform-diff";
import { logMutationError } from "@/lib/error-handlers";
import { WorkspaceDiffPanel } from "../components/workspace-diff-panel";
import type { WorkspaceListItem } from "../components/workspace-list-panel";
import { useAttemptStatusMap } from "../hooks/use-attempt-status-map";
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

interface WorkspacePageContentProps {
  projectId: string | undefined;
  ticketShorthand: string | undefined;
  ticket: NonNullable<ReturnType<typeof useProjectTickets>["data"]>[number];
  attemptStatusMap: ReturnType<typeof useAttemptStatusMap>;
  selectedWorkspaceLabel: string;
  selectedWorkspace: WorkspaceListItem | null;
  sessionsByWorkspaceId: ReturnType<typeof useWorkspaceSessions>;
  diffs: ReturnType<typeof transformFileDiffs>;
  artifacts: ApiWorkspaceArtifact[];
  attempts: NonNullable<ReturnType<typeof useProjectTickets>["data"]>[number]["attempts"];
  selectableFiles: ReturnType<typeof buildSelectableTicketFiles>;
  createAttemptIsPending: boolean;
  selectWorkspace: (workspaceShorthand: string) => void;
  selectSession: (workspaceShorthand: string, sessionId: string) => void;
  selectFile: (fileId: string) => void;
  isCreateModalOpen: boolean;
  closeCreateModal: () => void;
  runAttempt: () => Promise<boolean>;
  pluginActions: ReturnType<typeof usePluginActionTrigger>["pluginActions"];
  pluginActionTrigger: ReturnType<typeof usePluginActionTrigger>;
}

const WorkspacePageContent = (props: WorkspacePageContentProps) => {
  const {
    projectId,
    ticketShorthand,
    ticket,
    attemptStatusMap,
    selectedWorkspaceLabel,
    selectedWorkspace,
    sessionsByWorkspaceId,
    diffs,
    artifacts,
    attempts,
    selectableFiles,
    createAttemptIsPending,
    selectWorkspace,
    selectSession,
    selectFile,
    isCreateModalOpen,
    closeCreateModal,
    runAttempt,
    pluginActions,
    pluginActionTrigger,
  } = props;
  const { t } = useTranslation("projects");

  const sidebar = (
    <TicketSidebar
      files={selectableFiles}
      selectedFileId=""
      workspaces={attempts}
      attemptStatusMap={attemptStatusMap}
      sessionsByWorkspaceId={sessionsByWorkspaceId}
      selectedWorkspaceId={selectedWorkspace?.id}
      onSelectFile={selectFile}
      onSelectWorkspace={selectWorkspace}
      onSelectSession={selectSession}
    />
  );

  return (
    <PanelLayout sidebar={sidebar}>
      <Stack flex="1" gap="0" minH="0">
        <HorizontalMenuStack>
          <Flex align="center" gap="sm">
            <Breadcrumb
              separator="/"
              separatorGap="xs"
              linkComponent={Link}
              items={[
                {
                  title: (
                    <Flex as="span" align="center" gap="2xs">
                      <KanbanSquare size={14} />
                      {t("sidebar.tickets")}
                    </Flex>
                  ),
                  url: projectId ? `/projects/${projectId}/tickets` : undefined,
                },
                {
                  title: ticket.shorthand,
                  url: projectId && ticketShorthand ? `/projects/${projectId}/tickets/${ticketShorthand}` : undefined,
                },
                {
                  title: selectedWorkspaceLabel,
                  url:
                    projectId && ticketShorthand && selectedWorkspaceLabel
                      ? `/projects/${projectId}/tickets/${ticketShorthand}/workspaces/${selectedWorkspaceLabel}`
                      : undefined,
                },
              ]}
            />
          </Flex>

          <PluginHeaderActions
            pluginActions={pluginActions}
            onPluginAction={(actionKey) => {
              if (!selectedWorkspace) return;
              void pluginActionTrigger.trigger(actionKey, selectedWorkspace.id);
            }}
            pendingActionKey={pluginActionTrigger.pendingActionKey}
            isExecuting={pluginActionTrigger.isExecuting}
            overflowLabel="Workspace actions"
          />
        </HorizontalMenuStack>

        <Flex flex="1" minH="0">
          <WorkspaceDiffPanel diffs={diffs} artifacts={artifacts} />
        </Flex>

        {isCreateModalOpen ? (
          <CreateWorkspaceModal
            open={isCreateModalOpen}
            attemptCount={attempts.length}
            isSubmitting={createAttemptIsPending}
            onClose={closeCreateModal}
            onConfirm={runAttempt}
          />
        ) : null}

        {pluginActionTrigger.activeParamAction && projectId ? (
          <ActionParamsDialog
            open
            action={pluginActionTrigger.activeParamAction}
            projectId={projectId}
            isSubmitting={pluginActionTrigger.isExecuting}
            onClose={pluginActionTrigger.cancelParams}
            onSubmit={(params) => pluginActionTrigger.submitWithParams(params)}
          />
        ) : null}
      </Stack>
    </PanelLayout>
  );
};

export const WorkspacePage = () => {
  const { projectId, ticketShorthand, workspaceShorthand } = useParams({ strict: false });
  const navigate = useNavigate();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const projectSettingsStore = useProjectSettingsStoreApi();
  const setSessionModalState = useProjectSettingsStore((state) => state.setSessionModalState);
  const setSelectedSessionId = useProjectSettingsStore((state) => state.setSelectedSessionId);

  const { data: project } = useProject(projectId);
  const { data: allTickets = [] } = useProjectTickets(projectId);
  const ticket = allTickets.find((item) => item.shorthand === ticketShorthand) ?? null;
  const attempts = ticket?.attempts ?? [];
  const attemptStatusMap = useAttemptStatusMap(projectId);
  const createAttempt = useCreateTicketAttempt(projectId);
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
      pluginActions={selectedWorkspace ? pluginActionTrigger.pluginActions : []}
      pluginActionTrigger={pluginActionTrigger}
    />
  );
};
