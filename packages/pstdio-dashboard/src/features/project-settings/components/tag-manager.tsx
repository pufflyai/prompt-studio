import { Button, Editable, Flex, HStack, Icon, Input, Menu, Stack, Table } from "@chakra-ui/react";
import { closestCenter, DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DeleteConfirmationModal, ListRow, toaster } from "@pstdio/ui";
import { ChevronDown, GripVertical, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import {
  useCreateTagOption,
  useDeleteTagOption,
  useUpdateProjectTicketTag,
  useUpdateTagOption,
} from "@/features/ticket-list/hooks/use-project-tickets";
import type { TagType, TicketStatusColor, TicketTag } from "@/features/ticket-list/types";
import { TagIconColorPicker } from "./tag-icon-color-picker";
import { type DraftOption, saveTag, toDraftOptions } from "./tag-manager-save";

const TAG_TYPES: { value: TagType; label: string }[] = [
  { value: "single_select", label: "Single select" },
  { value: "multi_select", label: "Multi select" },
];

interface TagManagerProps {
  projectId: string | undefined;
  tag: TicketTag;
  onDeleteTag: (tagId: string) => void;
}

interface SortableOptionRowProps {
  option: DraftOption;
  disabled: boolean;
  onNameChange: (name: string) => void;
  onColorChange: (color: TicketStatusColor) => void;
  onIconChange: (icon: string | null) => void;
  onDescriptionChange: (description: string) => void;
  onDelete: () => void;
}

const SortableOptionRow = (props: SortableOptionRowProps) => {
  const { option, disabled, onNameChange, onColorChange, onIconChange, onDescriptionChange, onDelete } = props;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: option.id });

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
        <TagIconColorPicker
          color={option.color}
          icon={option.icon ?? null}
          onColorChange={onColorChange}
          onIconChange={onIconChange}
          disabled={disabled}
        />
      </Table.Cell>
      <Table.Cell>
        <Editable.Root
          defaultValue={option.name}
          onValueCommit={(details) => {
            const trimmed = details.value.trim();
            if (trimmed && trimmed !== option.name) onNameChange(trimmed);
          }}
        >
          <Editable.Preview />
          <Editable.Input />
        </Editable.Root>
      </Table.Cell>
      <Table.Cell>
        <Editable.Root
          defaultValue={option.description}
          placeholder="Add description..."
          onValueCommit={(details) => {
            if (details.value !== option.description) onDescriptionChange(details.value);
          }}
        >
          <Editable.Preview opacity={option.description ? 1 : 0.5} />
          <Editable.Input />
        </Editable.Root>
      </Table.Cell>
      <Table.Cell width="40px">
        <Button
          size="2xs"
          variant="ghost"
          colorPalette="red"
          onClick={onDelete}
          disabled={disabled}
          aria-label={`Delete ${option.name}`}
        >
          <Trash2 size={14} />
        </Button>
      </Table.Cell>
    </Table.Row>
  );
};

export const TagManager = (props: TagManagerProps) => {
  const { projectId, tag, onDeleteTag } = props;
  const updateTag = useUpdateProjectTicketTag(projectId);
  const createOption = useCreateTagOption(projectId);
  const updateOption = useUpdateTagOption(projectId);
  const deleteOptionMutation = useDeleteTagOption(projectId);

  const [draftName, setDraftName] = useState(tag.name);
  const [draftType, setDraftType] = useState<TagType>(tag.type);
  const [draftOptions, setDraftOptions] = useState<DraftOption[]>(() => toDraftOptions(tag));
  const [deletedOptionIds, setDeletedOptionIds] = useState<Set<string>>(new Set());

  const [isAdding, setIsAdding] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", color: "blue" as TicketStatusColor, icon: null as string | null });
  const [deleteOptionId, setDeleteOptionId] = useState<string | null>(null);
  const [isDeleteTagOpen, setIsDeleteTagOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const optionToDelete = draftOptions.find((o) => o.id === deleteOptionId);

  const hasChanges =
    draftName !== tag.name ||
    draftType !== tag.type ||
    deletedOptionIds.size > 0 ||
    draftOptions.some((draft) => {
      if (draft.isNew) return true;
      const original = tag.options.find((o) => o.id === draft.id);
      if (!original) return true;
      return (
        draft.name !== original.name ||
        draft.color !== original.color ||
        draft.icon !== (original.icon ?? null) ||
        draft.description !== (original.description ?? "") ||
        draft.sortOrder !== original.sortOrder
      );
    });

  const handleAddOption = () => {
    if (!addForm.name.trim()) return;
    const maxOrder = draftOptions.length > 0 ? Math.max(...draftOptions.map((o) => o.sortOrder)) : 0;
    setDraftOptions([
      ...draftOptions,
      {
        id: `new-${crypto.randomUUID()}`,
        name: addForm.name.trim(),
        color: addForm.color,
        icon: addForm.icon,
        description: "",
        sortOrder: maxOrder + 1,
        isNew: true,
      },
    ]);
    setIsAdding(false);
    setAddForm({ name: "", color: "blue", icon: null });
  };

  const handleDeleteOption = () => {
    if (!deleteOptionId) return;
    const option = draftOptions.find((o) => o.id === deleteOptionId);
    if (option && !option.isNew) {
      setDeletedOptionIds(new Set([...deletedOptionIds, deleteOptionId]));
    }
    setDraftOptions(draftOptions.filter((o) => o.id !== deleteOptionId));
    setDeleteOptionId(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = draftOptions.findIndex((o) => o.id === active.id);
    const newIndex = draftOptions.findIndex((o) => o.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(draftOptions, oldIndex, newIndex).map((o, i) => ({ ...o, sortOrder: i }));
    setDraftOptions(reordered);
  };

  const handleCancel = () => {
    setDraftName(tag.name);
    setDraftType(tag.type);
    setDraftOptions(toDraftOptions(tag));
    setDeletedOptionIds(new Set());
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveTag({
        tag,
        draftName,
        draftType,
        draftOptions,
        deletedOptionIds,
        updateTag: updateTag.mutateAsync,
        createOption: createOption.mutateAsync,
        updateOption: updateOption.mutateAsync,
        deleteOption: deleteOptionMutation.mutateAsync,
      });
      setDeletedOptionIds(new Set());
      toaster.create({ type: "success", title: "Tag saved" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save tag.";
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
            <Editable.Root
              key={`name-${tag.id}`}
              defaultValue={draftName}
              onValueCommit={(details) => {
                const trimmed = details.value.trim();
                if (trimmed) setDraftName(trimmed);
              }}
            >
              <Editable.Preview textStyle="heading/S" />
              <Editable.Input />
            </Editable.Root>
            <HStack gap="xs">
              <Menu.Root>
                <Menu.Trigger asChild>
                  <Button size="2xs" variant="outline" gap="xs">
                    {TAG_TYPES.find((t) => t.value === draftType)?.label ?? draftType}
                    <Icon as={ChevronDown} boxSize="12px" />
                  </Button>
                </Menu.Trigger>
                <Menu.Positioner>
                  <Menu.Content minW="160px" bg="bg">
                    {TAG_TYPES.map((t) => (
                      <Menu.Item key={t.value} value={t.value} asChild>
                        <ListRow
                          asChild
                          variant="compact"
                          id={t.value}
                          label={t.label}
                          isSelected={draftType === t.value}
                          onActivate={() => setDraftType(t.value)}
                        />
                      </Menu.Item>
                    ))}
                  </Menu.Content>
                </Menu.Positioner>
              </Menu.Root>
            </HStack>
          </Stack>
          <HStack gap="xs">
            <Button size="sm" variant="outline" onClick={() => setIsAdding(true)} disabled={isAdding || isSaving}>
              <Plus size={16} />
              Add option
            </Button>
          </HStack>
        </Flex>

        <Table.Root size="sm" variant="outline">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader width="40px" />
              <Table.ColumnHeader width="50px" />
              <Table.ColumnHeader>Name</Table.ColumnHeader>
              <Table.ColumnHeader>Description</Table.ColumnHeader>
              <Table.ColumnHeader width="40px" />
            </Table.Row>
          </Table.Header>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={draftOptions.map((o) => o.id)} strategy={verticalListSortingStrategy}>
              <Table.Body>
                {draftOptions.map((option, index) => (
                  <SortableOptionRow
                    key={option.id}
                    option={option}
                    disabled={isSaving}
                    onNameChange={(name) => {
                      const next = [...draftOptions];
                      next[index] = { ...next[index], name };
                      setDraftOptions(next);
                    }}
                    onColorChange={(color) => {
                      const next = [...draftOptions];
                      next[index] = { ...next[index], color };
                      setDraftOptions(next);
                    }}
                    onIconChange={(icon) => {
                      const next = [...draftOptions];
                      next[index] = { ...next[index], icon };
                      setDraftOptions(next);
                    }}
                    onDescriptionChange={(description) => {
                      const next = [...draftOptions];
                      next[index] = { ...next[index], description };
                      setDraftOptions(next);
                    }}
                    onDelete={() => setDeleteOptionId(option.id)}
                  />
                ))}
                {isAdding && (
                  <Table.Row>
                    <Table.Cell />
                    <Table.Cell>
                      <TagIconColorPicker
                        color={addForm.color}
                        icon={addForm.icon}
                        onColorChange={(color) => setAddForm({ ...addForm, color })}
                        onIconChange={(icon) => setAddForm({ ...addForm, icon })}
                      />
                    </Table.Cell>
                    <Table.Cell>
                      <Input
                        size="sm"
                        placeholder="Option name"
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

        <Flex justifyContent="space-between" alignItems="center">
          <Button
            size="sm"
            variant="ghost"
            colorPalette="red"
            onClick={() => setIsDeleteTagOpen(true)}
            disabled={isSaving}
          >
            <Trash2 size={14} />
            Delete tag
          </Button>
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
        open={Boolean(deleteOptionId)}
        onClose={() => setDeleteOptionId(null)}
        onDelete={handleDeleteOption}
        headline="Delete option?"
        notificationText={`This will remove the option "${optionToDelete?.name ?? ""}" from all tickets.`}
        buttonText="Delete option"
      />

      <DeleteConfirmationModal
        open={isDeleteTagOpen}
        onClose={() => setIsDeleteTagOpen(false)}
        onDelete={() => {
          setIsDeleteTagOpen(false);
          onDeleteTag(tag.id);
        }}
        headline="Delete tag?"
        notificationText={`This will remove the tag "${tag.name}" and all its options from every ticket in this project.`}
        buttonText="Delete tag"
      />
    </>
  );
};
