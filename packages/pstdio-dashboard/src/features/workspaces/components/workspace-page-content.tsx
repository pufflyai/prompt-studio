import { Flex, Stack } from "@chakra-ui/react";
import { Breadcrumb, DeleteConfirmationModal, HorizontalMenuStack, PanelLayout } from "@pstdio/ui";
import { Link } from "@tanstack/react-router";
import { Archive, KanbanSquare, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ActionParamsDialog } from "@/features/plugin-actions/components/action-params-dialog";
import { PluginHeaderActions } from "@/features/plugin-actions/components/plugin-header-actions";
import type { usePluginActionTrigger } from "@/features/plugin-actions/hooks/use-plugin-action-trigger";
import { CreateWorkspaceModal } from "@/features/ticket/components/create-workspace-modal";
import { TicketSidebar } from "@/features/ticket/components/ticket-sidebar";
import type { buildSelectableTicketFiles } from "@/features/ticket/utils/ticket-file-selection";
import type { ApiWorkspaceArtifact } from "@/features/ticket-list/data/api/types";
import type { useProjectTickets } from "@/features/ticket-list/hooks/use-project-tickets";
import type { transformFileDiffs } from "@/features/workspaces/utils/transform-diff";
import type { useAttemptStatusMap } from "../hooks/use-attempt-status-map";
import type { useWorkspaceSessions } from "../hooks/use-workspace-sessions";
import { WorkspaceDiffPanel } from "./workspace-diff-panel";
import type { WorkspaceListItem } from "./workspace-list-panel";

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
  archiveWorkspace: () => Promise<void>;
  deleteWorkspace: () => Promise<void>;
  isDeleteOpen: boolean;
  openDeleteModal: () => void;
  closeDeleteModal: () => void;
  pendingActionKey: string | null;
  isExecutingActions: boolean;
  pluginActions: ReturnType<typeof usePluginActionTrigger>["pluginActions"];
  pluginActionTrigger: ReturnType<typeof usePluginActionTrigger>;
}

export const WorkspacePageContent = (props: WorkspacePageContentProps) => {
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
    archiveWorkspace,
    deleteWorkspace,
    isDeleteOpen,
    openDeleteModal,
    closeDeleteModal,
    pendingActionKey,
    isExecutingActions,
    pluginActions,
    pluginActionTrigger,
  } = props;
  const { t } = useTranslation("projects");

  const defaultOverflowActions = [
    {
      key: "archive-workspace",
      label: t("projects:workspacePage.options.archiveWorkspace", { defaultValue: "Archive workspace" }),
      kind: "default" as const,
      icon: Archive,
      isDisabled: !selectedWorkspace || isExecutingActions,
      onClick: () => {
        void archiveWorkspace();
      },
    },
    {
      key: "delete-workspace",
      label: t("projects:workspacePage.options.deleteWorkspace", { defaultValue: "Delete workspace" }),
      kind: "default" as const,
      icon: Trash2,
      isDisabled: !selectedWorkspace || isExecutingActions,
      onClick: openDeleteModal,
    },
  ];

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
            defaultOverflowActions={defaultOverflowActions}
            onPluginAction={(actionKey) => {
              if (!selectedWorkspace) return;
              void pluginActionTrigger.trigger(actionKey, selectedWorkspace.id);
            }}
            pendingActionKey={pendingActionKey}
            isExecuting={isExecutingActions}
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

        <DeleteConfirmationModal
          open={isDeleteOpen}
          onClose={closeDeleteModal}
          onDelete={deleteWorkspace}
          headline={t("projects:workspacePage.deleteConfirmation.workspace.headline", {
            defaultValue: "Delete workspace?",
          })}
          notificationText={t("projects:workspacePage.deleteConfirmation.workspace.notification", {
            defaultValue: "This deletes the workspace and removes it from the ticket.",
          })}
          buttonText={t("projects:workspacePage.options.deleteWorkspace", { defaultValue: "Delete workspace" })}
        />
      </Stack>
    </PanelLayout>
  );
};
