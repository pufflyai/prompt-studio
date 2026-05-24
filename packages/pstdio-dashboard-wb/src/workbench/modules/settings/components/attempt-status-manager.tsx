import { Button, Editable, Flex, HStack, Input, Spinner, Stack, Table, Text } from "@chakra-ui/react";
import { closestCenter, DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DeleteConfirmationModal, toaster } from "@pstdio/ui";
import { Check, GripVertical, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import {
  type AttemptStatusOption,
  useCreateAttemptStatus,
  useDeleteAttemptStatus,
  useProjectAttemptStatuses,
  useUpdateAttemptStatus,
} from "../hooks/use-attempt-statuses";
import {
  type DraftAttemptStatus,
  hasAttemptStatusChanges,
  saveAttemptStatuses,
  toDraftAttemptStatuses,
} from "./attempt-status-manager-save";
import { StatusIconColorPicker } from "./status-icon-color-picker";

interface AttemptStatusManagerProps {
  projectId: string | undefined;
}

interface SortableRowProps {
  status: DraftAttemptStatus;
  isSaving: boolean;
  onNameChange: (name: string) => void;
  onColorChange: (color: string) => void;
  onIconChange: (icon: string | null) => void;
  onSetDefault: () => void;
  onDelete: () => void;
}

const SortableRow = (props: SortableRowProps) => {
  const { status, isSaving, onNameChange, onColorChange, onIconChange, onSetDefault, onDelete } = props;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: status.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Table.Row ref={setNodeRef} style={style}>
      <Table.Cell width="40px">
        <Flex cursor="grab" {...attributes} {...listeners}>
          <GripVertical size={14} color="var(--chakra-colors-fg-muted)" />
        </Flex>
      </Table.Cell>
      <Table.Cell width="50px">
        <StatusIconColorPicker
          color={status.color}
          icon={status.icon}
          onColorChange={onColorChange}
          onIconChange={onIconChange}
          disabled={isSaving}
        />
      </Table.Cell>
      <Table.Cell>
        <Editable.Root
          defaultValue={status.name}
          onValueCommit={(details) => {
            const trimmed = details.value.trim();
            if (trimmed && trimmed !== status.name) onNameChange(trimmed);
          }}
        >
          <Editable.Preview />
          <Editable.Input />
        </Editable.Root>
      </Table.Cell>
      <Table.Cell width="80px">
        <Button
          size="2xs"
          variant={status.isDefault ? "solid" : "ghost"}
          onClick={onSetDefault}
          disabled={isSaving || status.isDefault}
          aria-label={`Set ${status.name} as default`}
        >
          <Check size={14} />
        </Button>
      </Table.Cell>
      <Table.Cell width="40px">
        <Button
          size="2xs"
          variant="ghost"
          colorPalette="red"
          onClick={onDelete}
          disabled={isSaving || status.isDefault}
          aria-label={`Delete ${status.name}`}
        >
          <Trash2 size={14} />
        </Button>
      </Table.Cell>
    </Table.Row>
  );
};

interface AttemptStatusManagerViewProps {
  projectId: string;
  statuses: AttemptStatusOption[];
}

const AttemptStatusManagerView = (props: AttemptStatusManagerViewProps) => {
  const { projectId, statuses } = props;
  const createStatus = useCreateAttemptStatus(projectId);
  const updateStatus = useUpdateAttemptStatus(projectId);
  const deleteStatus = useDeleteAttemptStatus(projectId);

  const [drafts, setDrafts] = useState<DraftAttemptStatus[]>(() => toDraftAttemptStatuses(statuses));
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [newDefaultId, setNewDefaultId] = useState<string | null>(null);

  const [isAdding, setIsAdding] = useState(false);
  const [addForm, setAddForm] = useState<{ name: string; color: string; icon: string | null }>({
    name: "",
    color: "blue",
    icon: null,
  });
  const [deleteStatusId, setDeleteStatusId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const statusToDelete = drafts.find((s) => s.id === deleteStatusId);
  const hasChanges = hasAttemptStatusChanges(statuses, drafts, deletedIds, newDefaultId);

  const updateDraft = (index: number, patch: Partial<DraftAttemptStatus>) => {
    const next = [...drafts];
    next[index] = { ...next[index], ...patch };
    setDrafts(next);
  };

  const handleAddOption = () => {
    if (!addForm.name.trim()) return;
    const maxOrder = drafts.length > 0 ? Math.max(...drafts.map((s) => s.sortOrder)) : 0;
    setDrafts([
      ...drafts,
      {
        id: `new-${crypto.randomUUID()}`,
        name: addForm.name.trim(),
        color: addForm.color,
        icon: addForm.icon,
        sortOrder: maxOrder + 1,
        isDefault: false,
        isNew: true,
      },
    ]);
    setIsAdding(false);
    setAddForm({ name: "", color: "blue", icon: null });
  };

  const handleDeleteStatus = () => {
    if (!deleteStatusId) return;
    const status = drafts.find((s) => s.id === deleteStatusId);
    if (status && !status.isNew) {
      setDeletedIds(new Set([...deletedIds, deleteStatusId]));
    }
    setDrafts(drafts.filter((s) => s.id !== deleteStatusId));
    setDeleteStatusId(null);
  };

  const handleSetDefault = (statusId: string) => {
    const originalDefault = statuses.find((s) => s.isDefault);
    if (originalDefault?.id === statusId) {
      setNewDefaultId(null);
    } else {
      setNewDefaultId(statusId);
    }
    setDrafts(drafts.map((s) => ({ ...s, isDefault: s.id === statusId })));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = drafts.findIndex((s) => s.id === active.id);
    const newIndex = drafts.findIndex((s) => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(drafts, oldIndex, newIndex).map((s, i) => ({ ...s, sortOrder: i }));
    setDrafts(reordered);
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

  const handleAddKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleAddOption();
    if (e.key === "Escape") {
      setIsAdding(false);
      setAddForm({ name: "", color: "blue", icon: null });
    }
  };

  return (
    <>
      <Stack gap="md" padding="lg" height="100%">
        <Flex justifyContent="space-between" alignItems="center">
          <Stack gap="2xs">
            <Text textStyle="heading/S">Attempt statuses</Text>
            <Text textStyle="paragraph/S/regular" color="fg.muted">
              Manage status options used for workspace attempt workflows.
            </Text>
          </Stack>
          <Button size="sm" variant="outline" onClick={() => setIsAdding(true)} disabled={isAdding || isSaving}>
            <Plus size={16} />
            Add status
          </Button>
        </Flex>

        <Table.Root size="sm" variant="outline">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader width="40px" />
              <Table.ColumnHeader width="50px" />
              <Table.ColumnHeader>Name</Table.ColumnHeader>
              <Table.ColumnHeader width="80px">Default</Table.ColumnHeader>
              <Table.ColumnHeader width="40px" />
            </Table.Row>
          </Table.Header>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={drafts.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              <Table.Body>
                {drafts.map((status, index) => (
                  <SortableRow
                    key={status.id}
                    status={status}
                    isSaving={isSaving}
                    onNameChange={(name) => updateDraft(index, { name })}
                    onColorChange={(color) => updateDraft(index, { color })}
                    onIconChange={(icon) => updateDraft(index, { icon })}
                    onSetDefault={() => handleSetDefault(status.id)}
                    onDelete={() => setDeleteStatusId(status.id)}
                  />
                ))}
                {isAdding && (
                  <Table.Row>
                    <Table.Cell />
                    <Table.Cell>
                      <StatusIconColorPicker
                        color={addForm.color}
                        icon={addForm.icon}
                        onColorChange={(color) => setAddForm({ ...addForm, color })}
                        onIconChange={(icon) => setAddForm({ ...addForm, icon })}
                      />
                    </Table.Cell>
                    <Table.Cell>
                      <Input
                        size="sm"
                        placeholder="Status name"
                        value={addForm.name}
                        onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                        onKeyDown={handleAddKeyDown}
                        autoFocus
                      />
                    </Table.Cell>
                    <Table.Cell />
                    <Table.Cell>
                      <HStack gap="2xs">
                        <Button size="2xs" variant="primary" onClick={handleAddOption} disabled={!addForm.name.trim()}>
                          Add
                        </Button>
                        <Button
                          size="2xs"
                          variant="ghost"
                          onClick={() => {
                            setIsAdding(false);
                            setAddForm({ name: "", color: "blue", icon: null });
                          }}
                        >
                          <X size={14} />
                        </Button>
                      </HStack>
                    </Table.Cell>
                  </Table.Row>
                )}
              </Table.Body>
            </SortableContext>
          </DndContext>
        </Table.Root>

        <Flex justifyContent="flex-end">
          <HStack gap="xs">
            <Button size="sm" variant="outline" onClick={handleCancel} disabled={!hasChanges || isSaving}>
              Cancel
            </Button>
            <Button size="sm" variant="primary" onClick={handleSave} loading={isSaving} disabled={!hasChanges}>
              Save
            </Button>
          </HStack>
        </Flex>
      </Stack>

      <DeleteConfirmationModal
        open={Boolean(deleteStatusId)}
        onClose={() => setDeleteStatusId(null)}
        onDelete={handleDeleteStatus}
        headline="Delete attempt status?"
        notificationText={`This will delete status "${statusToDelete?.name ?? ""}" from this project.`}
        buttonText="Delete status"
      />
    </>
  );
};

export const AttemptStatusManager = (props: AttemptStatusManagerProps) => {
  const { projectId } = props;
  const { data: statuses, isLoading } = useProjectAttemptStatuses(projectId);

  if (!projectId) return null;

  if (isLoading || !statuses) {
    return (
      <Flex h="full" minH="0" align="center" justify="center" p="lg">
        <Spinner size="sm" />
      </Flex>
    );
  }

  return (
    <AttemptStatusManagerView key={statuses.map((s) => s.id).join(":")} projectId={projectId} statuses={statuses} />
  );
};
