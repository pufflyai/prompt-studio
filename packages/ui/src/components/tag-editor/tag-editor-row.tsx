import { Badge, Button, Editable, Flex, Icon, IconButton, Menu } from "@chakra-ui/react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, ChevronDown, GripVertical, Trash2 } from "lucide-react";

import { IconColorPicker } from "@/components/primitives/icon-color-picker";
import type { IconColorPickerIconOption } from "@/components/primitives/icon-options";
import { ListRow } from "../list-row/list-row";
import type { TagEditorAction, TagEditorValue } from "./tag-editor.types";

interface TagEditorRowProps {
  actionOptions?: TagEditorAction[];
  actionsLabel?: string;
  colorOptions?: readonly string[];
  iconOptions?: readonly IconColorPickerIconOption[];
  value: TagEditorValue;
  isSaving?: boolean;
  readOnly?: boolean;
  showDefault?: boolean;
  showIcons?: boolean;
  onActionsChange: (actions: string[]) => void;
  onColorChange: (color: string) => void;
  onDelete: () => void;
  onIconChange: (icon: string | null) => void;
  onNameChange: (name: string) => void;
}

/** Reads out the selected names rather than a count: a number says nothing about what is on. */
const selectionLabel = (selected: TagEditorAction[]) => {
  if (selected.length === 0) return "None";
  if (selected.length === 1) return selected[0].label;
  return `${selected[0].label} +${selected.length - 1}`;
};

const ActionDropdown = (props: {
  actions: string[];
  disabled?: boolean;
  label: string;
  options: TagEditorAction[];
  optionName: string;
  onChange: (actions: string[]) => void;
}) => {
  const { actions, disabled, label, options, optionName, onChange } = props;

  const selected = options.filter((option) => actions.includes(option.value));

  const toggleAction = (action: string) => {
    onChange(actions.includes(action) ? actions.filter((item) => item !== action) : [...actions, action]);
  };

  return (
    <Menu.Root closeOnSelect={false}>
      <Menu.Trigger asChild>
        <Button
          size="2xs"
          variant="ghost"
          gap="xs"
          color={selected.length === 0 ? "fg.subtle" : "fg"}
          disabled={disabled}
          aria-label={`${label} for ${optionName}`}
        >
          {selected[0]?.icon}
          {selectionLabel(selected)}
          <Icon as={ChevronDown} boxSize="icon-2xs" />
        </Button>
      </Menu.Trigger>
      <Menu.Positioner>
        <Menu.Content minW="tag-action-menu" bg="bg">
          {options.map((option) => (
            <Menu.Item key={option.value} value={option.value} asChild>
              <ListRow
                asChild
                variant="full-width"
                id={option.value}
                label={option.label}
                icon={option.icon}
                isSelected={actions.includes(option.value)}
                endContent={actions.includes(option.value) ? <Icon as={Check} boxSize="icon-xs" /> : undefined}
                onActivate={() => toggleAction(option.value)}
              />
            </Menu.Item>
          ))}
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
  );
};

export const TagEditorRow = (props: TagEditorRowProps) => {
  const {
    actionOptions,
    actionsLabel = "Actions",
    colorOptions,
    iconOptions,
    value,
    isSaving,
    readOnly,
    showDefault,
    showIcons,
    onActionsChange,
    onColorChange,
    onDelete,
    onIconChange,
    onNameChange,
  } = props;
  const disabled = isSaving || readOnly;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: value.id,
    disabled,
  });

  return (
    <Flex
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="group"
      height="tag-editor-row"
      alignItems="center"
      gap="compact"
      px="xs"
      borderBottomWidth="1px"
      borderColor="border.subtle"
      // Lifted out of the list while dragging, so the row carries the drag chrome.
      bg={isDragging ? "bg.elevated" : "transparent"}
      borderRadius={isDragging ? "compact" : "none"}
      borderWidth={isDragging ? "1px" : undefined}
      boxShadow={isDragging ? "lg" : undefined}
      _hover={{ bg: isDragging ? "bg.elevated" : "bg.muted" }}
    >
      <Flex
        cursor={readOnly ? "default" : "grab"}
        color="fg.subtle"
        _groupHover={{ color: "fg.muted" }}
        aria-label={`Reorder ${value.name}`}
        {...attributes}
        {...listeners}
      >
        <Icon as={GripVertical} boxSize="icon-xs" />
      </Flex>
      <IconColorPicker
        color={value.color}
        colorOptions={colorOptions}
        icon={value.icon}
        iconOptions={iconOptions}
        showIcons={showIcons}
        onColorChange={onColorChange}
        onIconChange={onIconChange}
        disabled={disabled}
        aria-label={`Change ${value.name} appearance`}
      />
      {/* The default marker belongs to the name, so it sits beside it rather than drifting right. */}
      <Flex flex="1" minWidth="0" alignItems="center" gap="xs">
        <Editable.Root
          // Editable owns its draft text, so a changed source name must remount it for Cancel/reset flows.
          key={value.name}
          minWidth="0"
          defaultValue={value.name}
          // A freshly added option opens straight into its rename input.
          defaultEdit={value.isNew}
          selectOnFocus
          disabled={disabled}
          onValueCommit={(details) => {
            const trimmed = details.value.trim();
            if (trimmed && trimmed !== value.name) onNameChange(trimmed);
          }}
        >
          <Editable.Preview textStyle="paragraph/S/regular" />
          <Editable.Input textStyle="paragraph/S/regular" />
        </Editable.Root>
        {showDefault && value.isDefault ? (
          <Badge size="sm" variant="subtle" colorPalette="blue">
            Default
          </Badge>
        ) : null}
      </Flex>
      {actionOptions ? (
        <Flex width="tag-editor-commands" justifyContent="flex-end">
          <ActionDropdown
            actions={value.actions ?? []}
            disabled={disabled}
            label={actionsLabel}
            optionName={value.name}
            options={actionOptions}
            onChange={onActionsChange}
          />
        </Flex>
      ) : null}
      <IconButton
        size="xs"
        variant="ghost"
        color="fg.subtle"
        _groupHover={{ color: "fg.error", bg: "bg.error" }}
        onClick={onDelete}
        disabled={disabled || value.isDefault}
        aria-label={`Delete ${value.name}`}
      >
        <Icon as={Trash2} boxSize="icon-xs" />
      </IconButton>
    </Flex>
  );
};
