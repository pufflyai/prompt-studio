import { Button, Flex, HStack, Input, Stack, Table, Text } from "@chakra-ui/react";
import { closestCenter, DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus, X } from "lucide-react";
import type { KeyboardEvent } from "react";
import { useState } from "react";

import { DeleteConfirmationModal } from "../delete-confirmation-modal";
import { IconColorPicker } from "../icon-color-picker";
import type { TagEditorProps, TagEditorValue } from "./tag-editor.types";
import { TagEditorRow } from "./tag-editor-row";

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

export const TagEditor = (props: TagEditorProps) => {
  const {
    title,
    description,
    values,
    onValuesChange,
    onSave,
    onCancel,
    onDeleteValue,
    onSetDefault,
    hasChanges,
    isSaving,
    addLabel = "Add tag",
    addPlaceholder = "Tag name",
    actionOptions,
    actionsColumnLabel = "Actions",
    cancelLabel = "Cancel",
    colorOptions,
    defaultAddColor = "blue",
    defaultAddIcon = null,
    defaultColumnLabel = "Default",
    deleteButtonText = "Delete tag",
    deleteHeadline = "Delete tag?",
    deleteNotificationText = (value) => `This will delete "${value.name}".`,
    iconOptions,
    saveLabel = "Save",
    showDefault,
    showIcons = true,
    valueColumnLabel = "Name",
  } = props;
  const [isAdding, setIsAdding] = useState(false);
  const [addForm, setAddForm] = useState<AddFormState>({ name: "", color: defaultAddColor, icon: defaultAddIcon });
  const [valueToDelete, setValueToDelete] = useState<TagEditorValue | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const resetAddForm = () => {
    setIsAdding(false);
    setAddForm({ name: "", color: defaultAddColor, icon: defaultAddIcon });
  };

  const updateValue = (index: number, patch: Partial<TagEditorValue>) => {
    const next = [...values];
    next[index] = { ...next[index], ...patch };
    onValuesChange(next);
  };

  const handleAddOption = () => {
    if (!addForm.name.trim()) return;
    const maxOrder = values.length > 0 ? Math.max(...values.map((value) => value.sortOrder)) : 0;
    onValuesChange([...values, buildDraftItem(addForm, maxOrder + 1)]);
    resetAddForm();
  };

  const handleDeleteOption = () => {
    if (!valueToDelete) return;
    if (onDeleteValue) {
      onDeleteValue(valueToDelete);
    } else {
      onValuesChange(values.filter((value) => value.id !== valueToDelete.id));
    }
    setValueToDelete(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = values.findIndex((value) => value.id === active.id);
    const newIndex = values.findIndex((value) => value.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    onValuesChange(arrayMove(values, oldIndex, newIndex).map((value, index) => ({ ...value, sortOrder: index })));
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
              <Table.ColumnHeader>{valueColumnLabel}</Table.ColumnHeader>
              <Table.ColumnHeader width="54px" />
              {showDefault ? <Table.ColumnHeader width="80px">{defaultColumnLabel}</Table.ColumnHeader> : null}
              {actionOptions ? <Table.ColumnHeader width="140px">{actionsColumnLabel}</Table.ColumnHeader> : null}
              <Table.ColumnHeader width="40px" />
            </Table.Row>
          </Table.Header>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={values.map((value) => value.id)} strategy={verticalListSortingStrategy}>
              <Table.Body>
                {values.map((value, index) => (
                  <TagEditorRow
                    key={value.id}
                    value={value}
                    isSaving={isSaving}
                    showDefault={showDefault}
                    showIcons={showIcons}
                    actionOptions={actionOptions}
                    colorOptions={colorOptions}
                    iconOptions={iconOptions}
                    onNameChange={(name) => updateValue(index, { name })}
                    onColorChange={(color) => updateValue(index, { color })}
                    onIconChange={(icon) => updateValue(index, { icon })}
                    onActionsChange={(actions) => updateValue(index, { actions })}
                    onSetDefault={() => onSetDefault?.(value)}
                    onDelete={() => setValueToDelete(value)}
                  />
                ))}
                {isAdding ? (
                  <Table.Row>
                    <Table.Cell />
                    <Table.Cell>
                      <Input
                        size="xs"
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
                        colorOptions={colorOptions}
                        iconOptions={iconOptions}
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
                        <Button size="2xs" variant="ghost" onClick={resetAddForm} aria-label="Cancel add value">
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
        open={Boolean(valueToDelete)}
        onClose={() => setValueToDelete(null)}
        onDelete={handleDeleteOption}
        headline={deleteHeadline}
        notificationText={valueToDelete ? deleteNotificationText(valueToDelete) : ""}
        buttonText={deleteButtonText}
      />
    </>
  );
};
