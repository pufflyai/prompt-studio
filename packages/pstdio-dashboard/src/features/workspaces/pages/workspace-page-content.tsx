import { Flex, Stack } from "@chakra-ui/react";
import { Breadcrumb, DeleteConfirmationModal, HorizontalMenuStack, PanelLayout } from "@pstdio/ui";
import { Link } from "@tanstack/react-router";
import { KanbanSquare } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ActionParamsDialog } from "@/features/plugin-actions/components/action-params-dialog";
import { PluginHeaderActions } from "@/features/plugin-actions/components/plugin-header-actions";
import type { usePluginActionTrigger } from "@/features/plugin-actions/hooks/use-plugin-action-trigger";
import {
  buildResourceContextMenuActions,
  toSidebarContextMenuItems,
} from "@/features/plugin-actions/hooks/use-resource-context-menu";
import { CreateWorkspaceModal } from "@/features/ticket/components/create-workspace-modal";
import { TicketSidebar } from "@/features/ticket/components/ticket-sidebar";
import { formatTicketBreadcrumbLabel } from "@/features/ticket/utils/ticket-breadcrumb";
import type { buildSelectableTicketFiles } from "@/features/ticket/utils/ticket-file-selection";
import type { ApiFileDiff, ApiWorkspaceArtifact } from "@/features/ticket-list/data/api/types";
import type { useProjectTickets } from "@/features/ticket-list/hooks/use-project-tickets";
import type { transformFileDiffs } from "@/features/workspaces/utils/transform-diff";
import { getAttemptLabelFromWorkspaceShorthand } from "@/features/workspaces/utils/workspace-shorthand";
import { WorkspaceDiffPanel } from "../components/workspace-diff-panel";
import type { WorkspaceListItem } from "../components/workspace-list-panel";
import type { useAttemptStatusMap } from "../hooks/use-attempt-status-map";
import type { useWorkspaceSessions } from "../hooks/use-workspace-sessions";
import { buildWorkspaceDeleteOverflowAction } from "./workspace-page-actions";
import type { WorkspacePageTab } from "./workspace-page-tab";

interface WorkspacePageContentProps {
  projectId: string | undefined;
  ticketShorthand: string | undefined;
  ticket: NonNullable<ReturnType<typeof useProjectTickets>["data"]>[number];
  attemptStatusMap: ReturnType<typeof useAttemptStatusMap>;
  diffTotalsByWorkspaceId: Map<string, { additions: number; deletions: number }>;
  selectedWorkspaceLabel: string;
  selectedWorkspace: WorkspaceListItem | null;
  sessionsByWorkspaceId: ReturnType<typeof useWorkspaceSessions>["sessionsByWorkspaceId"];
  diffs: ReturnType<typeof transformFileDiffs>;
  artifacts: ApiWorkspaceArtifact[];
  changedFiles: ApiFileDiff[];
  isDiffLoading: boolean;
  attempts: NonNullable<ReturnType<typeof useProjectTickets>["data"]>[number]["attempts"];
  selectableFiles: ReturnType<typeof buildSelectableTicketFiles>;
  createAttemptIsPending: boolean;
  activeSessionId: string | null;
  selectWorkspace: (workspaceShorthand: string) => void;
  selectSession: (workspaceShorthand: string, sessionId: string) => void;
  selectedTab: WorkspacePageTab;
  selectTab: (tab: WorkspacePageTab) => void;
  createWorkspaceSessionDraft: (workspaceId: string) => void;
  selectFile: (fileId: string) => void;
  selectPlanning: () => void;
  isCreateModalOpen: boolean;
  closeCreateModal: () => void;
  runAttempt: () => Promise<boolean>;
  resolveTicketContextMenuItems: () => ReturnType<typeof toSidebarContextMenuItems>;
  resolveSessionContextMenuItems: (session: {
    id: string;
    agentSessionId?: string | null;
  }) => ReturnType<typeof toSidebarContextMenuItems>;
  pluginActions: ReturnType<typeof usePluginActionTrigger>["pluginActions"];
  pluginActionsLoading: boolean;
  pluginActionTrigger: ReturnType<typeof usePluginActionTrigger>;
  ticketActionTrigger: ReturnType<typeof usePluginActionTrigger>;
  sessionActionTrigger: ReturnType<typeof usePluginActionTrigger>;
  isTicketDeleteOpen: boolean;
  closeTicketDeleteModal: () => void;
  deleteTicket: () => Promise<void>;
  deleteWorkspaceIsPending: boolean;
  isDeleteOpen: boolean;
  openDeleteModal: () => void;
  closeDeleteModal: () => void;
  deleteWorkspace: () => Promise<void>;
}

export const WorkspacePageContent = (props: WorkspacePageContentProps) => {
  const {
    projectId,
    ticketShorthand,
    ticket,
    attemptStatusMap,
    diffTotalsByWorkspaceId,
    selectedWorkspaceLabel,
    selectedWorkspace,
    sessionsByWorkspaceId,
    diffs,
    artifacts,
    changedFiles,
    isDiffLoading,
    attempts,
    selectableFiles,
    createAttemptIsPending,
    activeSessionId,
    selectWorkspace,
    selectSession,
    selectedTab,
    selectTab,
    createWorkspaceSessionDraft,
    selectFile,
    selectPlanning,
    isCreateModalOpen,
    closeCreateModal,
    runAttempt,
    resolveTicketContextMenuItems,
    resolveSessionContextMenuItems,
    pluginActions,
    pluginActionsLoading,
    pluginActionTrigger,
    ticketActionTrigger,
    sessionActionTrigger,
    isTicketDeleteOpen,
    closeTicketDeleteModal,
    deleteTicket,
    deleteWorkspaceIsPending,
    isDeleteOpen,
    openDeleteModal,
    closeDeleteModal,
    deleteWorkspace,
  } = props;
  const { t } = useTranslation("projects");

  const defaultOverflowActions = buildWorkspaceDeleteOverflowAction({
    t,
    hasSelectedWorkspace: Boolean(selectedWorkspace),
    isMutationPending: deleteWorkspaceIsPending,
    onDeleteWorkspace: openDeleteModal,
  });

  const sidebar = (
    <TicketSidebar
      files={selectableFiles}
      selectedFileId=""
      workspaces={attempts}
      attemptStatusMap={attemptStatusMap}
      diffTotalsByWorkspaceId={diffTotalsByWorkspaceId}
      sessionsByWorkspaceId={sessionsByWorkspaceId}
      selectedWorkspaceId={selectedWorkspace?.id}
      activeSessionId={activeSessionId}
      onSelectFile={selectFile}
      onSelectWorkspace={selectWorkspace}
      onSelectSession={selectSession}
      onCreateWorkspaceSessionDraft={createWorkspaceSessionDraft}
      onSelectPlanning={selectPlanning}
      resolveTicketContextMenuItems={resolveTicketContextMenuItems}
      resolveWorkspaceContextMenuItems={(workspace) =>
        toSidebarContextMenuItems(
          buildResourceContextMenuActions({
            pluginActions,
            defaultOverflowActions: buildWorkspaceDeleteOverflowAction({
              t,
              hasSelectedWorkspace: true,
              isMutationPending: deleteWorkspaceIsPending,
              onDeleteWorkspace: () => {
                selectWorkspace(workspace.shorthand);
                openDeleteModal();
              },
            }),
            pendingActionKeys: pluginActionTrigger.pendingActionKeys,
            onPluginAction: (actionKey) => void pluginActionTrigger.trigger(actionKey, workspace.id),
          }),
        )
      }
      resolveSessionContextMenuItems={resolveSessionContextMenuItems}
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
                  title: formatTicketBreadcrumbLabel(ticket.shorthand, ticket.title),
                  url: projectId && ticketShorthand ? `/projects/${projectId}/tickets/${ticketShorthand}` : undefined,
                },
                {
                  title: getAttemptLabelFromWorkspaceShorthand(selectedWorkspaceLabel),
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
            defaultOverflowActions={defaultOverflowActions}
            onPluginAction={(actionKey) => {
              if (!selectedWorkspace) return;
              void pluginActionTrigger.trigger(actionKey, selectedWorkspace.id);
            }}
            pendingActionKeys={pluginActionTrigger.pendingActionKeys}
            overflowLabel={t("workspacePanel.options.workspace")}
            isLoading={pluginActionsLoading}
          />
        </HorizontalMenuStack>

        <Flex flex="1" minH="0">
          <WorkspaceDiffPanel
            ticketId={ticket.id}
            diffs={diffs}
            artifacts={artifacts}
            changedFiles={changedFiles}
            loading={isDiffLoading}
            activeTab={selectedTab}
            onTabChange={selectTab}
          />
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
            isSubmitting={pluginActionTrigger.activeParamActionIsPending}
            onClose={pluginActionTrigger.cancelParams}
            onSubmit={(params) => pluginActionTrigger.submitWithParams(params)}
          />
        ) : null}

        {ticketActionTrigger.activeParamAction && projectId ? (
          <ActionParamsDialog
            open
            action={ticketActionTrigger.activeParamAction}
            projectId={projectId}
            isSubmitting={ticketActionTrigger.activeParamActionIsPending}
            onClose={ticketActionTrigger.cancelParams}
            onSubmit={(params) => ticketActionTrigger.submitWithParams(params)}
          />
        ) : null}

        {sessionActionTrigger.activeParamAction && projectId ? (
          <ActionParamsDialog
            open
            action={sessionActionTrigger.activeParamAction}
            projectId={projectId}
            isSubmitting={sessionActionTrigger.activeParamActionIsPending}
            onClose={sessionActionTrigger.cancelParams}
            onSubmit={(params) => sessionActionTrigger.submitWithParams(params)}
          />
        ) : null}

        <DeleteConfirmationModal
          open={isTicketDeleteOpen}
          onClose={closeTicketDeleteModal}
          onDelete={deleteTicket}
          headline={t("projects:ticketPanel.deleteConfirmation.ticket.headline")}
          notificationText={t("projects:ticketPanel.deleteConfirmation.ticket.notification")}
          buttonText={t("projects:ticketPanel.options.deleteTicket")}
        />

        <DeleteConfirmationModal
          open={isDeleteOpen}
          onClose={closeDeleteModal}
          onDelete={deleteWorkspace}
          headline={t("workspacePanel.deleteConfirmation.workspace.headline")}
          notificationText={t("workspacePanel.deleteConfirmation.workspace.notification")}
          buttonText={t("workspacePanel.options.deleteWorkspace")}
        />
      </Stack>
    </PanelLayout>
  );
};
