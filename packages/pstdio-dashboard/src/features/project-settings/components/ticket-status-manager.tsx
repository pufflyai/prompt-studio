import { Button, Editable, Flex, HStack, Icon, Input, Menu, Stack, Table, Text } from "@chakra-ui/react";
import { closestCenter, DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DeleteConfirmationModal, ListRow, toaster } from "@pstdio/ui";
import { Check, ChevronDown, Circle, GripVertical, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import {
  useCreateProjectTicketStatus,
  useDeleteProjectTicketStatusDefinition,
  useSetProjectDefaultTicketStatus,
  useUpdateProjectTicketStatusDefinition,
} from "@/features/ticket-list/hooks/use-project-tickets";
import type { StatusAction, TicketStatusColor, TicketStatusOption } from "@/features/ticket-list/types";
import { type DraftStatus, hasStatusChanges, saveStatuses, toDraftStatuses } from "./ticket-status-manager-save";

const STATUS_COLORS: TicketStatusColor[] = [
  "gray",
  "red",
  "orange",
  "yellow",
  "green",
  "teal",
  "blue",
  "cyan",
  "purple",
  "pink",
];

const ALL_STATUS_ACTIONS: { value: StatusAction; label: string }[] = [
  { value: "create_ticket", label: "Create ticket" },
  { value: "drag_in", label: "Drag in" },
  { value: "drag_out", label: "Drag out" },
  { value: "archive_all", label: "Archive all" },
];

interface TicketStatusManagerProps {
  projectId: string | undefined;
  statuses: TicketStatusOption[];
}

const ColorPicker = (props: {
  value: TicketStatusColor;
  onChange: (color: TicketStatusColor) => void;
  disabled?: boolean;
}) => {
  const { value, onChange, disabled } = props;

  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <Button size="2xs" variant="ghost" gap="xs" disabled={disabled}>
          <Icon as={Circle} boxSize="14px" fill={`${value}.500`} color={`${value}.500`} />
        </Button>
      </Menu.Trigger>
      <Menu.Positioner>
        <Menu.Content minW="120px" bg="bg">
          {STATUS_COLORS.map((color) => (
            <Menu.Item key={color} value={color} asChild>
              <ListRow
                asChild
                variant="compact"
                id={color}
                label={color}
                icon={<Icon as={Circle} boxSize="16px" />}
                iconColor={`${color}.500`}
                isSelected={color === value}
                onActivate={() => onChange(color)}
              />
            </Menu.Item>
          ))}
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
  );
};

const ActionsDropdown = (props: {
  actions: StatusAction[];
  onChange: (actions: StatusAction[]) => void;
  disabled: boolean;
}) => {
  const { actions, onChange, disabled } = props;

  const toggleAction = (action: StatusAction) => {
    const next = actions.includes(action) ? actions.filter((a) => a !== action) : [...actions, action];
    onChange(next);
  };

  return (
    <Menu.Root closeOnSelect={false}>
      <Menu.Trigger asChild>
        <Button size="2xs" variant="outline" gap="xs" disabled={disabled}>
          {actions.length} action{actions.length !== 1 ? "s" : ""}
          <Icon as={ChevronDown} boxSize="12px" />
        </Button>
      </Menu.Trigger>
      <Menu.Positioner>
        <Menu.Content minW="160px" bg="bg">
          {ALL_STATUS_ACTIONS.map((action) => (
            <Menu.Item key={action.value} value={action.value} asChild>
              <ListRow
                asChild
                variant="compact"
                id={action.value}
                label={action.label}
                isSelected={actions.includes(action.value)}
                onActivate={() => toggleAction(action.value)}
              />
            </Menu.Item>
          ))}
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
  );
};

interface SortableRowProps {
  status: DraftStatus;
  isSaving: boolean;
  onNameChange: (name: string) => void;
  onColorChange: (color: TicketStatusColor) => void;
  onSetDefault: () => void;
  onDelete: () => void;
  onActionsChange: (actions: StatusAction[]) => void;
}

const SortableRow = (props: SortableRowProps) => {
  const { status, isSaving, onNameChange, onColorChange, onSetDefault, onDelete, onActionsChange } = props;

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
      <Table.Cell width="50px">
        <ColorPicker value={status.color} onChange={onColorChange} disabled={isSaving} />
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
      <Table.Cell>
        <ActionsDropdown actions={status.actions} onChange={onActionsChange} disabled={isSaving} />
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

export const TicketStatusManager = (props: TicketStatusManagerProps) => {
  const { projectId, statuses } = props;
  const createStatus = useCreateProjectTicketStatus(projectId);
  const updateStatus = useUpdateProjectTicketStatusDefinition(projectId);
  const setDefaultStatus = useSetProjectDefaultTicketStatus(projectId);
  const deleteStatus = useDeleteProjectTicketStatusDefinition(projectId);

  const [drafts, setDrafts] = useState<DraftStatus[]>(() => toDraftStatuses(statuses));
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [newDefaultId, setNewDefaultId] = useState<string | null>(null);

  const [isAdding, setIsAdding] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", color: "blue" as TicketStatusColor });
  const [deleteStatusId, setDeleteStatusId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const statusToDelete = drafts.find((s) => s.id === deleteStatusId);
  const hasChanges = hasStatusChanges(statuses, drafts, deletedIds, newDefaultId);

  const updateDraft = (index: number, patch: Partial<DraftStatus>) => {
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
        sortOrder: maxOrder + 1,
        isDefault: false,
        actions: ["drag_in", "drag_out"],
        isNew: true,
      },
    ]);
    setIsAdding(false);
    setAddForm({ name: "", color: "blue" });
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
    // If reverting to original default, clear newDefaultId
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
    setDrafts(toDraftStatuses(statuses));
    setDeletedIds(new Set());
    setNewDefaultId(null);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveStatuses({
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
      toaster.create({ type: "success", title: "Statuses saved" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save statuses.";
      toaster.create({ type: "error", title: "Save failed", description: message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleAddOption();
    if (e.key === "Escape") {
      setIsAdding(false);
      setAddForm({ name: "", color: "blue" });
    }
  };

  return (
    <>
      <Stack gap="md" padding="lg" height="100%">
        <Flex justifyContent="space-between" alignItems="center">
          <Stack gap="2xs">
            <Text textStyle="heading/S">Statuses</Text>
            <Text textStyle="paragraph/S/regular" color="fg.muted">
              Manage status options used for ticket workflows.
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
              <Table.ColumnHeader>Name</Table.ColumnHeader>
              <Table.ColumnHeader width="50px" />
              <Table.ColumnHeader width="80px">Default</Table.ColumnHeader>
              <Table.ColumnHeader>Actions</Table.ColumnHeader>
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
                    onSetDefault={() => handleSetDefault(status.id)}
                    onDelete={() => setDeleteStatusId(status.id)}
                    onActionsChange={(actions) => updateDraft(index, { actions })}
                  />
                ))}
                {isAdding && (
                  <Table.Row>
                    <Table.Cell />
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
                    <Table.Cell>
                      <ColorPicker value={addForm.color} onChange={(color) => setAddForm({ ...addForm, color })} />
                    </Table.Cell>
                    <Table.Cell />
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
                            setAddForm({ name: "", color: "blue" });
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
        headline="Delete status?"
        notificationText={`This will delete status "${statusToDelete?.name ?? ""}" from this project.`}
        buttonText="Delete status"
      />
    </>
  );
};
