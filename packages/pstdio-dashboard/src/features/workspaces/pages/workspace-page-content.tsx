import { Flex, Stack } from "@chakra-ui/react";
import { Breadcrumb, DeleteConfirmationModal, HorizontalMenuStack, PanelLayout } from "@pstdio/ui";
import { Link } from "@tanstack/react-router";
import { KanbanSquare } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ActionParamsDialog } from "@/features/plugin-actions/components/action-params-dialog";
import { PluginHeaderActions } from "@/features/plugin-actions/components/plugin-header-actions";
import type { usePluginActionTrigger } from "@/features/plugin-actions/hooks/use-plugin-action-trigger";
import {
  buildResourceContextMenuActions,
  toSidebarContextMenuItems,
} from "@/features/plugin-actions/hooks/use-resource-context-menu";
import { CreateWorkspaceModal } from "@/features/ticket/components/create-workspace-modal";
import { TICKET_SIDEBAR_STORAGE_KEY, TicketSidebar } from "@/features/ticket/components/ticket-sidebar";
import { formatTicketBreadcrumbLabel } from "@/features/ticket/utils/ticket-breadcrumb";
import type { buildSelectableTicketFiles } from "@/features/ticket/utils/ticket-file-selection";
import type { useProjectTickets } from "@/features/ticket-list/hooks/use-project-tickets";
import type { TicketSubTicket } from "@/features/ticket-list/types";
import type { transformFileDiffs } from "@/features/workspaces/utils/transform-diff";
import { getAttemptLabelFromWorkspaceShorthand } from "@/features/workspaces/utils/workspace-shorthand";
import type { ApiFileDiff, ApiWorkspaceArtifact } from "@/shared/api-types";
import { markAfterPaint } from "@/shared/performance/mark-after-paint";
import { OpenSidebarButton } from "@/shared/sidebar/open-sidebar-button";
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
  sidebarSubTickets: TicketSubTicket[];
  knownTicketIds: string[];
  attemptStatusMap: ReturnType<typeof useAttemptStatusMap>;
  diffTotalsByWorkspaceId: Map<string, { additions: number; deletions: number }>;
  selectedWorkspaceLabel: string;
  selectedWorkspace: WorkspaceListItem | null;
  sessionsByWorkspaceId: ReturnType<typeof useWorkspaceSessions>["sessionsByWorkspaceId"];
  diffs: ReturnType<typeof transformFileDiffs>;
  artifacts: ApiWorkspaceArtifact[];
  changedFiles: ApiFileDiff[];
  diffGeneration: number;
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
  selectSubTicket: (ticketShorthand: string) => void;
  selectPlanning: () => void;
  createWorkspace: () => void;
  isCreateWorkspaceModalOpen: boolean;
  closeCreateWorkspaceModal: () => void;
  createWorkspaceLabel: string;
  createWorkspaceDescription: string;
  createEmptyWorkspace: () => Promise<boolean>;
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

const WorkspaceCreationModals = (props: {
  attemptsCount: number;
  isSubmitting: boolean;
  isCreateWorkspaceModalOpen: boolean;
  closeCreateWorkspaceModal: () => void;
  createWorkspaceLabel: string;
  createWorkspaceDescription: string;
  createEmptyWorkspace: () => Promise<boolean>;
}) => {
  const {
    attemptsCount,
    isSubmitting,
    isCreateWorkspaceModalOpen,
    closeCreateWorkspaceModal,
    createWorkspaceLabel,
    createWorkspaceDescription,
    createEmptyWorkspace,
  } = props;

  return (
    <>
      {isCreateWorkspaceModalOpen ? (
        <CreateWorkspaceModal
          open={isCreateWorkspaceModalOpen}
          attemptCount={attemptsCount}
          showAgentSelector={false}
          isSubmitting={isSubmitting}
          confirmLabel={createWorkspaceLabel}
          description={createWorkspaceDescription}
          onClose={closeCreateWorkspaceModal}
          onConfirm={createEmptyWorkspace}
        />
      ) : null}
    </>
  );
};

const ActionParamsModal = (props: { projectId: string; actionTrigger: ReturnType<typeof usePluginActionTrigger> }) => {
  const { projectId, actionTrigger } = props;

  if (!actionTrigger.activeParamAction) {
    return null;
  }

  return (
    <ActionParamsDialog
      open
      action={actionTrigger.activeParamAction}
      projectId={projectId}
      isSubmitting={actionTrigger.activeParamActionIsPending}
      onClose={actionTrigger.cancelParams}
      onSubmit={(params) => actionTrigger.submitWithParams(params)}
    />
  );
};

export const WorkspacePageContent = (props: WorkspacePageContentProps) => {
  const {
    projectId,
    ticketShorthand,
    ticket,
    sidebarSubTickets,
    knownTicketIds,
    attemptStatusMap,
    diffTotalsByWorkspaceId,
    selectedWorkspaceLabel,
    selectedWorkspace,
    sessionsByWorkspaceId,
    diffs,
    artifacts,
    changedFiles,
    diffGeneration,
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
    selectSubTicket,
    selectPlanning,
    createWorkspace,
    isCreateWorkspaceModalOpen,
    closeCreateWorkspaceModal,
    createWorkspaceLabel,
    createWorkspaceDescription,
    createEmptyWorkspace,
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
  const readinessKey = `${projectId ?? ""}:${ticketShorthand ?? ""}:${selectedWorkspace?.id ?? ""}:${selectedTab}`;

  useEffect(() => {
    void readinessKey;
    markAfterPaint("app:workspace-page-ready");
  }, [readinessKey]);

  const defaultOverflowActions = buildWorkspaceDeleteOverflowAction({
    t,
    hasSelectedWorkspace: Boolean(selectedWorkspace),
    isMutationPending: deleteWorkspaceIsPending,
    onDeleteWorkspace: openDeleteModal,
  });

  const sidebar = (
    <TicketSidebar
      files={selectableFiles}
      subTickets={sidebarSubTickets}
      knownSubTicketIds={knownTicketIds}
      selectedFileId=""
      workspaces={attempts}
      attemptStatusMap={attemptStatusMap}
      diffTotalsByWorkspaceId={diffTotalsByWorkspaceId}
      sessionsByWorkspaceId={sessionsByWorkspaceId}
      selectedWorkspaceId={selectedWorkspace?.id}
      activeSessionId={activeSessionId}
      onSelectFile={selectFile}
      onSelectSubTicket={selectSubTicket}
      onSelectWorkspace={selectWorkspace}
      onSelectSession={selectSession}
      onCreateWorkspace={createWorkspace}
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
            <OpenSidebarButton storageKey={TICKET_SIDEBAR_STORAGE_KEY} />
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
            workspaceId={selectedWorkspace?.id ?? null}
            diffs={diffs}
            artifacts={artifacts}
            changedFiles={changedFiles}
            diffGeneration={diffGeneration}
            loading={isDiffLoading}
            activeTab={selectedTab}
            onTabChange={selectTab}
          />
        </Flex>

        <WorkspaceCreationModals
          attemptsCount={attempts.length}
          isSubmitting={createAttemptIsPending}
          isCreateWorkspaceModalOpen={isCreateWorkspaceModalOpen}
          closeCreateWorkspaceModal={closeCreateWorkspaceModal}
          createWorkspaceLabel={createWorkspaceLabel}
          createWorkspaceDescription={createWorkspaceDescription}
          createEmptyWorkspace={createEmptyWorkspace}
        />

        {projectId ? <ActionParamsModal projectId={projectId} actionTrigger={pluginActionTrigger} /> : null}

        {projectId ? <ActionParamsModal projectId={projectId} actionTrigger={ticketActionTrigger} /> : null}

        {projectId ? <ActionParamsModal projectId={projectId} actionTrigger={sessionActionTrigger} /> : null}

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
