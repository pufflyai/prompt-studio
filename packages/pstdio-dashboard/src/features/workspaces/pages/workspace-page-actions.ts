import { Trash2 } from "lucide-react";
import type { HeaderActionItem } from "@/features/plugin-actions/components/header-action-groups";
import { logMutationError } from "@/lib/error-handlers";

interface BuildWorkspaceDeleteOverflowActionInput {
  t: (key: string) => string;
  hasSelectedWorkspace: boolean;
  isMutationPending: boolean;
  onDeleteWorkspace: () => void;
}

export const buildWorkspaceDeleteOverflowAction = (
  input: BuildWorkspaceDeleteOverflowActionInput,
): HeaderActionItem[] => {
  const { t, hasSelectedWorkspace, isMutationPending, onDeleteWorkspace } = input;

  return [
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
