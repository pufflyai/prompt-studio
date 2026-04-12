import { Archive, Trash2 } from "lucide-react";
import type { HeaderActionItem } from "@/features/plugin-actions/components/header-action-groups";
import { logMutationError } from "@/lib/error-handlers";

interface BuildWorkspaceDefaultOverflowActionsInput {
  t: (key: string) => string;
  hasSelectedWorkspace: boolean;
  isMutationPending: boolean;
  onArchiveWorkspace: () => void;
  onDeleteWorkspace: () => void;
}

export const buildWorkspaceDefaultOverflowActions = (
  input: BuildWorkspaceDefaultOverflowActionsInput,
): HeaderActionItem[] => {
  const { t, hasSelectedWorkspace, isMutationPending, onArchiveWorkspace, onDeleteWorkspace } = input;

  return [
    {
      key: "archive-workspace",
      label: t("workspacePanel.options.archiveWorkspace"),
      kind: "default",
      icon: Archive,
      isDisabled: !hasSelectedWorkspace || isMutationPending,
      onClick: onArchiveWorkspace,
    },
    {
      key: "delete-workspace",
      label: t("workspacePanel.options.deleteWorkspace"),
      kind: "default",
      icon: Trash2,
      isDisabled: !hasSelectedWorkspace || isMutationPending,
      onClick: onDeleteWorkspace,
    },
  ];
};

interface WorkspaceArchiveFlowInput {
  selectedWorkspaceId: string | null;
  archiveWorkspace: (workspaceId: string) => Promise<void>;
  navigateToTicket: () => Promise<void>;
}

export const runWorkspaceArchiveFlow = async (input: WorkspaceArchiveFlowInput) => {
  const { selectedWorkspaceId, archiveWorkspace, navigateToTicket } = input;
  if (!selectedWorkspaceId) return;

  try {
    await archiveWorkspace(selectedWorkspaceId);
    await navigateToTicket();
  } catch (error) {
    logMutationError("archive workspace", error);
  }
};

interface WorkspaceDeleteFlowInput {
  selectedWorkspaceId: string | null;
  deleteWorkspace: (workspaceId: string) => Promise<void>;
  closeDeleteModal: () => void;
  navigateToTicket: () => Promise<void>;
}

export const runWorkspaceDeleteFlow = async (input: WorkspaceDeleteFlowInput) => {
  const { selectedWorkspaceId, deleteWorkspace, closeDeleteModal, navigateToTicket } = input;
  if (!selectedWorkspaceId) return;

  try {
    await deleteWorkspace(selectedWorkspaceId);
    closeDeleteModal();
    await navigateToTicket();
  } catch (error) {
    logMutationError("delete workspace", error);
    throw error;
  }
};
