import { Button, Flex, HStack, Input, Stack, Table, Text } from "@chakra-ui/react";
import { closestCenter, DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus, X } from "lucide-react";
import type { KeyboardEvent } from "react";
import { useState } from "react";

import { DeleteConfirmationModal } from "../delete-confirmation-modal";
import { IconColorPicker } from "../icon-color-picker";
import type { StatusOptionEditorItem, StatusOptionEditorProps } from "./status-option-editor.types";
import { StatusOptionRow } from "./status-option-row";

interface AddFormState {
  name: string;
  color: string;
  icon: string | null;
}

const buildDraftItem = (form: AddFormState, sortOrder: number) => ({
  id: `new-${crypto.randomUUID()}`,
  name: form.name.trim(),
  color: form.color,
  icon: form.icon,
  sortOrder,
  isNew: true,
});

export const StatusOptionEditor = (props: StatusOptionEditorProps) => {
  const {
    title,
    description,
    items,
    onItemsChange,
    onSave,
    onCancel,
    onDeleteItem,
    onSetDefault,
    hasChanges,
    isSaving,
    addLabel = "Add status",
    addPlaceholder = "Status name",
    actionOptions,
    actionsColumnLabel = "Actions",
    cancelLabel = "Cancel",
    defaultAddColor = "blue",
    defaultColumnLabel = "Default",
    deleteButtonText = "Delete status",
    deleteHeadline = "Delete status?",
    deleteNotificationText = (item) => `This will delete status "${item.name}".`,
    saveLabel = "Save",
    showDefault,
    showIcons = true,
  } = props;
  const [isAdding, setIsAdding] = useState(false);
  const [addForm, setAddForm] = useState<AddFormState>({ name: "", color: defaultAddColor, icon: null });
  const [itemToDelete, setItemToDelete] = useState<StatusOptionEditorItem | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const resetAddForm = () => {
    setIsAdding(false);
    setAddForm({ name: "", color: defaultAddColor, icon: null });
  };

  const updateItem = (index: number, patch: Partial<StatusOptionEditorItem>) => {
    const next = [...items];
    next[index] = { ...next[index], ...patch };
    onItemsChange(next);
  };

  const handleAddOption = () => {
    if (!addForm.name.trim()) return;
    const maxOrder = items.length > 0 ? Math.max(...items.map((item) => item.sortOrder)) : 0;
    onItemsChange([...items, buildDraftItem(addForm, maxOrder + 1)]);
    resetAddForm();
  };

  const handleDeleteOption = () => {
    if (!itemToDelete) return;
    if (onDeleteItem) {
      onDeleteItem(itemToDelete);
    } else {
      onItemsChange(items.filter((item) => item.id !== itemToDelete.id));
    }
    setItemToDelete(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    onItemsChange(arrayMove(items, oldIndex, newIndex).map((item, index) => ({ ...item, sortOrder: index })));
  };

  const handleAddKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") handleAddOption();
    if (event.key === "Escape") resetAddForm();
  };

  return (
    <>
      <Stack gap="md" height="100%">
        <Flex justifyContent="space-between" alignItems="center" gap="sm" flexWrap="wrap">
          <Stack gap="2xs">
            <Text textStyle="heading/S">{title}</Text>
            {description ? (
              <Text textStyle="paragraph/S/regular" color="fg.muted">
                {description}
              </Text>
            ) : null}
          </Stack>
          <Button size="sm" variant="outline" onClick={() => setIsAdding(true)} disabled={isAdding || isSaving}>
            <Plus size={16} />
            {addLabel}
          </Button>
        </Flex>

        <Table.Root size="sm" variant="outline">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader width="40px" />
              <Table.ColumnHeader>Name</Table.ColumnHeader>
              <Table.ColumnHeader width="54px" />
              {showDefault ? <Table.ColumnHeader width="80px">{defaultColumnLabel}</Table.ColumnHeader> : null}
              {actionOptions ? <Table.ColumnHeader width="140px">{actionsColumnLabel}</Table.ColumnHeader> : null}
              <Table.ColumnHeader width="40px" />
            </Table.Row>
          </Table.Header>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
              <Table.Body>
                {items.map((item, index) => (
                  <StatusOptionRow
                    key={item.id}
                    item={item}
                    isSaving={isSaving}
                    showDefault={showDefault}
                    showIcons={showIcons}
                    actionOptions={actionOptions}
                    onNameChange={(name) => updateItem(index, { name })}
                    onColorChange={(color) => updateItem(index, { color })}
                    onIconChange={(icon) => updateItem(index, { icon })}
                    onActionsChange={(actions) => updateItem(index, { actions })}
                    onSetDefault={() => onSetDefault?.(item)}
                    onDelete={() => setItemToDelete(item)}
                  />
                ))}
                {isAdding ? (
                  <Table.Row>
                    <Table.Cell />
                    <Table.Cell>
                      <Input
                        size="sm"
                        placeholder={addPlaceholder}
                        value={addForm.name}
                        onChange={(event) => setAddForm({ ...addForm, name: event.target.value })}
                        onKeyDown={handleAddKeyDown}
                        autoFocus
                      />
                    </Table.Cell>
                    <Table.Cell>
                      <IconColorPicker
                        color={addForm.color}
                        icon={addForm.icon}
                        showIcons={showIcons}
                        onColorChange={(color) => setAddForm({ ...addForm, color })}
                        onIconChange={(icon) => setAddForm({ ...addForm, icon })}
                      />
                    </Table.Cell>
                    {showDefault ? <Table.Cell /> : null}
                    {actionOptions ? <Table.Cell /> : null}
                    <Table.Cell>
                      <HStack gap="2xs">
                        <Button size="2xs" variant="primary" onClick={handleAddOption} disabled={!addForm.name.trim()}>
                          Add
                        </Button>
                        <Button size="2xs" variant="ghost" onClick={resetAddForm} aria-label="Cancel add status">
                          <X size={14} />
                        </Button>
                      </HStack>
                    </Table.Cell>
                  </Table.Row>
                ) : null}
              </Table.Body>
            </SortableContext>
          </DndContext>
        </Table.Root>

        <Flex justifyContent="flex-end">
          <HStack gap="xs">
            <Button size="sm" variant="outline" onClick={onCancel} disabled={!hasChanges || isSaving}>
              {cancelLabel}
            </Button>
            <Button size="sm" variant="primary" onClick={onSave} loading={isSaving} disabled={!hasChanges}>
              {saveLabel}
            </Button>
          </HStack>
        </Flex>
      </Stack>

      <DeleteConfirmationModal
        open={Boolean(itemToDelete)}
        onClose={() => setItemToDelete(null)}
        onDelete={handleDeleteOption}
        headline={deleteHeadline}
        notificationText={itemToDelete ? deleteNotificationText(itemToDelete) : ""}
        buttonText={deleteButtonText}
      />
    </>
  );
};
