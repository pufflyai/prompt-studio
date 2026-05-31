import { Box } from "@chakra-ui/react";
import { StatusOptionEditor, type StatusOptionEditorItem, toaster } from "@pstdio/ui";
import { useState } from "react";

import {
  type AttemptStatusOption,
  useCreateAttemptStatus,
  useDeleteAttemptStatus,
  useUpdateAttemptStatus,
} from "../hooks/use-attempt-statuses";
import {
  type DraftAttemptStatus,
  hasAttemptStatusChanges,
  saveAttemptStatuses,
  toDraftAttemptStatuses,
} from "./attempt-status-manager-save";

interface AttemptStatusManagerProps {
  projectId: string | undefined;
  statuses: AttemptStatusOption[];
}

const toDrafts = (items: StatusOptionEditorItem[]): DraftAttemptStatus[] =>
  items.map((item) => ({
    id: item.id,
    name: item.name,
    color: item.color,
    sortOrder: item.sortOrder,
    isDefault: Boolean(item.isDefault),
    isNew: item.isNew,
  }));

export const AttemptStatusManager = (props: AttemptStatusManagerProps) => {
  const { projectId, statuses } = props;
  const createStatus = useCreateAttemptStatus(projectId);
  const updateStatus = useUpdateAttemptStatus(projectId);
  const deleteStatus = useDeleteAttemptStatus(projectId);

  const [drafts, setDrafts] = useState<DraftAttemptStatus[]>(() => toDraftAttemptStatuses(statuses));
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [newDefaultId, setNewDefaultId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const hasChanges = hasAttemptStatusChanges(statuses, drafts, deletedIds, newDefaultId);

  const handleDeleteStatus = (status: StatusOptionEditorItem) => {
    if (!status.isNew) setDeletedIds(new Set([...deletedIds, status.id]));
    setDrafts(drafts.filter((draft) => draft.id !== status.id));
  };

  const handleSetDefault = (status: StatusOptionEditorItem) => {
    const originalDefault = statuses.find((option) => option.isDefault);
    setNewDefaultId(originalDefault?.id === status.id ? null : status.id);
    setDrafts(drafts.map((draft) => ({ ...draft, isDefault: draft.id === status.id })));
  };

  const handleCancel = () => {
    setDrafts(toDraftAttemptStatuses(statuses));
    setDeletedIds(new Set());
    setNewDefaultId(null);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveAttemptStatuses({
        original: statuses,
        drafts,
        deletedIds,
        newDefaultId,
        createStatus: createStatus.mutateAsync,
        updateStatus: updateStatus.mutateAsync,
        deleteStatus: deleteStatus.mutateAsync,
      });
      setDeletedIds(new Set());
      setNewDefaultId(null);
      toaster.create({ type: "success", title: "Attempt statuses saved" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save attempt statuses.";
      toaster.create({ type: "error", title: "Save failed", description: message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Box padding="lg" height="100%">
      <StatusOptionEditor
        title="Attempt Statuses"
        description="Manage status options used for workspace attempt workflows."
        items={drafts}
        onItemsChange={(items: StatusOptionEditorItem[]) => setDrafts(toDrafts(items))}
        onSetDefault={handleSetDefault}
        onDeleteItem={handleDeleteStatus}
        hasChanges={hasChanges}
        isSaving={isSaving}
        showDefault
        showIcons={false}
        addLabel="Add status"
        addPlaceholder="Status name"
        deleteHeadline="Delete attempt status?"
        deleteNotificationText={(status: StatusOptionEditorItem) =>
          `This will delete status "${status.name}" from this project.`
        }
        deleteButtonText="Delete status"
        onSave={handleSave}
        onCancel={handleCancel}
      />
    </Box>
  );
};
