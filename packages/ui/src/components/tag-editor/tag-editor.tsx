import { chakra, Editable, Flex, Icon, Stack, Text } from "@chakra-ui/react";
import { closestCenter, DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { useState } from "react";

import { DeleteConfirmationModal } from "@/components/overlays/delete-confirmation-modal";
import type { TagEditorProps, TagEditorValue } from "./tag-editor.types";
import { TagEditorHeading } from "./tag-editor-heading";
import { TagEditorRow } from "./tag-editor-row";

const nextSortOrder = (values: TagEditorValue[]) =>
  values.length > 0 ? Math.max(...values.map((value) => value.sortOrder)) + 1 : 0;

interface TagEditorTitleProps {
  title: string;
  hasChanges?: boolean;
  isSaving?: boolean;
  onTitleChange?: (title: string) => void;
}

/** Renames the tag definition inline, matching how its options are renamed. */
const TagEditorTitle = (props: TagEditorTitleProps) => {
  const { title, hasChanges, isSaving, onTitleChange } = props;

  if (!onTitleChange) return <TagEditorHeading hasChanges={hasChanges}>{title}</TagEditorHeading>;

  return (
    <Editable.Root
      key={title}
      defaultValue={title}
      disabled={isSaving}
      selectOnFocus
      onValueCommit={(details) => {
        const trimmed = details.value.trim();
        if (trimmed && trimmed !== title) onTitleChange(trimmed);
      }}
    >
      <Editable.Preview textStyle="label/L/medium" />
      <Editable.Input textStyle="label/L/medium" />
    </Editable.Root>
  );
};

const AddOptionRow = chakra("button", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "xs",
    height: "tag-editor-add-row",
    paddingInline: "xs",
    color: "fg.muted",
    borderRadius: "compact",
    cursor: "pointer",
    _hover: { bg: "bg.muted", color: "fg" },
    _disabled: { cursor: "not-allowed", opacity: 0.5, _hover: { bg: "transparent", color: "fg.muted" } },
  },
});

export const TagEditor = (props: TagEditorProps) => {
  const {
    title,
    description,
    headerActions,
    values,
    onValuesChange,
    onDeleteValue,
    onSetDefault,
    onTitleChange,
    hasChanges,
    isSaving,
    addLabel = "Add option",
    addName = "New option",
    actionOptions,
    colorOptions,
    defaultAddColor = "blue",
    defaultAddIcon = null,
    deleteButtonText = "Delete tag",
    deleteHeadline = "Delete tag?",
    deleteNotificationText = (value) => `This will delete "${value.name}".`,
    iconOptions,
    showDefault,
    showIcons = true,
  } = props;
  const [valueToDelete, setValueToDelete] = useState<TagEditorValue | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const updateValue = (index: number, patch: Partial<TagEditorValue>) => {
    const next = [...values];
    next[index] = { ...next[index], ...patch };
    onValuesChange(next);
  };

  const handleAddOption = () => {
    onValuesChange([
      ...values,
      {
        id: `new-${crypto.randomUUID()}`,
        name: addName,
        color: defaultAddColor,
        icon: defaultAddIcon,
        sortOrder: nextSortOrder(values),
        isNew: true,
      },
    ]);
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

  return (
    <>
      <Stack gap="2xs">
        {title || headerActions ? (
          <Flex minHeight="tag-editor-row" alignItems="center" justifyContent="space-between" gap="xs">
            <Stack gap="3xs" minWidth="0">
              {title ? (
                <TagEditorTitle
                  title={title}
                  hasChanges={hasChanges}
                  isSaving={isSaving}
                  onTitleChange={onTitleChange}
                />
              ) : null}
              {description ? (
                <Text textStyle="paragraph/S/regular" color="fg.muted">
                  {description}
                </Text>
              ) : null}
            </Stack>
            {headerActions}
          </Flex>
        ) : null}

        <Stack gap="none">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={values.map((value) => value.id)} strategy={verticalListSortingStrategy}>
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
            </SortableContext>
          </DndContext>

          <AddOptionRow type="button" disabled={isSaving} onClick={handleAddOption}>
            <Icon as={Plus} boxSize="icon-xs" />
            <Text textStyle="paragraph/S/regular">{addLabel}</Text>
          </AddOptionRow>
        </Stack>
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
