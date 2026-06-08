import { Box } from "@chakra-ui/react";
import { TagEditor, type TagEditorValue, toaster } from "@pstdio/ui";
import { useState } from "react";

import {
  type AttemptStatusOption,
  useCreateAttemptStatus,
  useDeleteAttemptStatus,
  useSetDefaultAttemptStatus,
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

const toDrafts = (values: TagEditorValue[]): DraftAttemptStatus[] =>
  values.map((value) => ({
    id: value.id,
    name: value.name,
    color: value.color,
    sortOrder: value.sortOrder,
    isDefault: Boolean(value.isDefault),
    isNew: value.isNew,
  }));

export const AttemptStatusManager = (props: AttemptStatusManagerProps) => {
  const { projectId, statuses } = props;
  const createStatus = useCreateAttemptStatus(projectId);
  const updateStatus = useUpdateAttemptStatus(projectId);
  const setDefaultStatus = useSetDefaultAttemptStatus(projectId);
  const deleteStatus = useDeleteAttemptStatus(projectId);

  const [drafts, setDrafts] = useState<DraftAttemptStatus[]>(() => toDraftAttemptStatuses(statuses));
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [newDefaultId, setNewDefaultId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const hasChanges = hasAttemptStatusChanges(statuses, drafts, deletedIds, newDefaultId);

  const handleDeleteStatus = (status: TagEditorValue) => {
    if (!status.isNew) setDeletedIds(new Set([...deletedIds, status.id]));
    setDrafts(drafts.filter((draft) => draft.id !== status.id));
  };

  const handleSetDefault = (status: TagEditorValue) => {
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
        setDefaultStatus: setDefaultStatus.mutateAsync,
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
      <TagEditor
        title="Attempt Statuses"
        description="Manage status options used for workspace attempt workflows."
        values={drafts}
        onValuesChange={(values: TagEditorValue[]) => setDrafts(toDrafts(values))}
        onSetDefault={handleSetDefault}
        onDeleteValue={handleDeleteStatus}
        hasChanges={hasChanges}
        isSaving={isSaving}
        showDefault
        showIcons={false}
        addLabel="Add status"
        addPlaceholder="Status name"
        deleteHeadline="Delete attempt status?"
        deleteNotificationText={(status: TagEditorValue) =>
          `This will delete status "${status.name}" from this project.`
        }
        deleteButtonText="Delete status"
        onSave={handleSave}
        onCancel={handleCancel}
      />
    </Box>
  );
};
