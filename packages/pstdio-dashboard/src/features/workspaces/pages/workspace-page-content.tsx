import { Flex, Stack } from "@chakra-ui/react";
import { DeleteConfirmationModal, PanelLayout } from "@pstdio/ui";
import { KanbanSquare } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TICKET_SIDEBAR_STORAGE_KEY, TicketSidebar } from "@/features/ticket/components/ticket-sidebar";
import { WorkspaceCreationDialogs } from "@/features/ticket/components/workspace-creation-dialogs";
import { formatTicketBreadcrumbLabel } from "@/features/ticket/utils/ticket-breadcrumb";
import type { buildSelectableTicketFiles } from "@/features/ticket/utils/ticket-file-selection";
import type { useProjectTickets } from "@/features/ticket-list/hooks/use-project-tickets";
import type { TicketSubTicket } from "@/features/ticket-list/types";
import type { transformFileDiffs } from "@/features/workspaces/utils/transform-diff";
import { getAttemptLabelFromWorkspaceShorthand } from "@/features/workspaces/utils/workspace-shorthand";
import type { ApiFileDiff, ApiWorkspaceArtifact } from "@/shared/api-types";
import { HeaderActions, mergeHeaderOverflowActions } from "@/shared/extensions/components/header-actions";
import {
  headerActionsToResourceContextActions,
  toSidebarContextMenuItems,
} from "@/shared/extensions/context-menu-actions";
import { useExtensionHeaderActions } from "@/shared/extensions/hooks/use-extension-header-actions";
import { useExtensionResourceContextMenuActions } from "@/shared/extensions/hooks/use-extension-resource-context-menu-actions";
import { buildWorkspaceExtensionResource } from "@/shared/extensions/resource-context";
import { useDeferredPageMount } from "@/shared/performance/use-deferred-page-mount";
import { WorkspaceDiffPanel } from "../components/workspace-diff-panel";
import type { WorkspaceListItem } from "../components/workspace-list-panel";
import type { useAttemptStatusMap } from "../hooks/use-attempt-status-map";
import type { useWorkspaceSessions } from "../hooks/use-workspace-sessions";
import { buildWorkspaceDeleteOverflowAction } from "./workspace-page-actions";
import { WorkspacePageHeader } from "./workspace-page-header";
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
  useDeferredPageMount(
    "workspace",
    `${projectId ?? ""}:${ticketShorthand ?? ""}:${selectedWorkspace?.id ?? ""}:${selectedTab}`,
  );

  const defaultOverflowActions = buildWorkspaceDeleteOverflowAction({
    t,
    hasSelectedWorkspace: Boolean(selectedWorkspace),
    isMutationPending: deleteWorkspaceIsPending,
    onDeleteWorkspace: openDeleteModal,
  });
  const workspaceResource = selectedWorkspace
    ? buildWorkspaceExtensionResource({ projectId, ticket, workspace: selectedWorkspace })
    : undefined;
  const workspaceOverflowActions = useExtensionHeaderActions({
    slotId: "workspace.headerOverflow",
    resource: workspaceResource,
    enabled: Boolean(workspaceResource),
  });
  const workspaceContextMenuActions = useExtensionResourceContextMenuActions({
    slotId: ["workspace.headerPrimary", "workspace.headerOverflow"],
  });
  const headerOverflowActions = mergeHeaderOverflowActions({
    customActions: workspaceOverflowActions.actions,
    defaultActions: defaultOverflowActions,
  });
  const headerPendingActionKeys = workspaceOverflowActions.pendingActionKeys;
  const breadcrumbItems = [
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
  ];

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
        toSidebarContextMenuItems([
          ...workspaceContextMenuActions.resolveActions(
            buildWorkspaceExtensionResource({ projectId, ticket, workspace }),
          ),
          ...headerActionsToResourceContextActions({
            actions: buildWorkspaceDeleteOverflowAction({
              t,
              hasSelectedWorkspace: true,
              isMutationPending: deleteWorkspaceIsPending,
              onDeleteWorkspace: () => {
                selectWorkspace(workspace.shorthand);
                openDeleteModal();
              },
            }),
          }),
        ])
      }
      resolveSessionContextMenuItems={resolveSessionContextMenuItems}
    />
  );
  return (
    <PanelLayout sidebar={sidebar}>
      <Stack flex="1" gap="0" minH="0">
        <WorkspacePageHeader
          breadcrumbItems={breadcrumbItems}
          extensionResource={workspaceResource}
          sidebarStorageKey={TICKET_SIDEBAR_STORAGE_KEY}
        >
          <HeaderActions
            overflowActions={headerOverflowActions}
            pendingActionKeys={headerPendingActionKeys}
            overflowLabel={t("workspacePanel.options.workspace")}
          />
        </WorkspacePageHeader>

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

        <WorkspaceCreationDialogs
          attemptsCount={attempts.length}
          isSubmitting={createAttemptIsPending}
          isCreateWorkspaceModalOpen={isCreateWorkspaceModalOpen}
          closeCreateWorkspaceModal={closeCreateWorkspaceModal}
          createWorkspaceLabel={createWorkspaceLabel}
          createWorkspaceDescription={createWorkspaceDescription}
          createEmptyWorkspace={createEmptyWorkspace}
        />

        {workspaceOverflowActions.paramsDialog}
        {workspaceContextMenuActions.paramsDialog}

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
