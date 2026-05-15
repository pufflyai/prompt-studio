import { Flex, Stack } from "@chakra-ui/react";
import { DeleteConfirmationModal } from "@pstdio/ui";
import { useTranslation } from "react-i18next";
import { ActionParamsDialog } from "@/features/plugin-actions/components/action-params-dialog";
import type { usePluginActionTrigger } from "@/features/plugin-actions/hooks/use-plugin-action-trigger";
import { CreateWorkspaceModal } from "@/features/ticket/components/create-workspace-modal";
import type { useProjectTickets } from "@/features/ticket-list/hooks/use-project-tickets";
import type { transformFileDiffs } from "@/features/workspaces/utils/transform-diff";
import type { ApiFileDiff, ApiWorkspaceArtifact } from "@/shared/api-types";
import { useDeferredPageMount } from "@/shared/performance/use-deferred-page-mount";
import { WorkspaceDiffPanel } from "../components/workspace-diff-panel";
import type { WorkspaceListItem } from "../components/workspace-list-panel";
import type { WorkspacePageTab } from "./workspace-page-tab";

interface WorkspacePageContentProps {
  projectId: string | undefined;
  ticket: NonNullable<ReturnType<typeof useProjectTickets>["data"]>[number];
  selectedWorkspace: WorkspaceListItem | null;
  diffs: ReturnType<typeof transformFileDiffs>;
  artifacts: ApiWorkspaceArtifact[];
  changedFiles: ApiFileDiff[];
  diffGeneration: number;
  isDiffLoading: boolean;
  attempts: NonNullable<ReturnType<typeof useProjectTickets>["data"]>[number]["attempts"];
  createAttemptIsPending: boolean;
  selectedTab: WorkspacePageTab;
  selectTab: (tab: WorkspacePageTab) => void;
  isCreateWorkspaceModalOpen: boolean;
  closeCreateWorkspaceModal: () => void;
  createWorkspaceLabel: string;
  createWorkspaceDescription: string;
  createEmptyWorkspace: () => Promise<boolean>;
  pluginActionTrigger: ReturnType<typeof usePluginActionTrigger>;
  ticketActionTrigger: ReturnType<typeof usePluginActionTrigger>;
  sessionActionTrigger: ReturnType<typeof usePluginActionTrigger>;
  isTicketDeleteOpen: boolean;
  closeTicketDeleteModal: () => void;
  deleteTicket: () => Promise<void>;
  isDeleteOpen: boolean;
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
    ticket,
    selectedWorkspace,
    diffs,
    artifacts,
    changedFiles,
    diffGeneration,
    isDiffLoading,
    attempts,
    createAttemptIsPending,
    selectedTab,
    selectTab,
    isCreateWorkspaceModalOpen,
    closeCreateWorkspaceModal,
    createWorkspaceLabel,
    createWorkspaceDescription,
    createEmptyWorkspace,
    pluginActionTrigger,
    ticketActionTrigger,
    sessionActionTrigger,
    isTicketDeleteOpen,
    closeTicketDeleteModal,
    deleteTicket,
    isDeleteOpen,
    closeDeleteModal,
    deleteWorkspace,
  } = props;
  const { t } = useTranslation("projects");
  useDeferredPageMount(
    "workspace",
    `${projectId ?? ""}:${ticket.shorthand}:${selectedWorkspace?.id ?? ""}:${selectedTab}`,
  );
  return (
    <Stack flex="1" h="full" minH="0" minW="0" gap="0" overflow="hidden">
      <Flex flex="1" minH="0" minW="0" overflow="hidden">
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
  );
};
