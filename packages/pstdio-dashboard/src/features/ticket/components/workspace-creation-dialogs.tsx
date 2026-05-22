import { CreateWorkspaceModal } from "./create-workspace-modal";

interface WorkspaceCreationDialogsProps {
  attemptsCount: number;
  isSubmitting: boolean;
  isCreateWorkspaceModalOpen: boolean;
  closeCreateWorkspaceModal: () => void;
  createWorkspaceLabel: string;
  createWorkspaceDescription: string;
  createEmptyWorkspace: () => Promise<boolean>;
}

export const WorkspaceCreationDialogs = (props: WorkspaceCreationDialogsProps) => {
  const {
    attemptsCount,
    isSubmitting,
    isCreateWorkspaceModalOpen,
    closeCreateWorkspaceModal,
    createWorkspaceLabel,
    createWorkspaceDescription,
    createEmptyWorkspace,
  } = props;

  if (!isCreateWorkspaceModalOpen) return null;

  return (
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
  );
};
