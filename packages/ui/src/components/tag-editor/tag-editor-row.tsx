import { Button, Editable, Flex, Icon, IconButton, Menu } from "@chakra-ui/react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, ChevronDown, GripVertical, Trash2 } from "lucide-react";

import { IconColorPicker } from "@/components/primitives/icon-color-picker";
import type { IconColorPickerIconOption } from "@/components/primitives/icon-options";
import { ListRow } from "../list-row/list-row";
import type { TagEditorAction, TagEditorValue } from "./tag-editor.types";

interface TagEditorRowProps {
  actionOptions?: TagEditorAction[];
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
  onSetDefault: () => void;
}

const ActionDropdown = (props: {
  actions: string[];
  disabled?: boolean;
  options: TagEditorAction[];
  onChange: (actions: string[]) => void;
}) => {
  const { actions, disabled, options, onChange } = props;

  const toggleAction = (action: string) => {
    onChange(actions.includes(action) ? actions.filter((item) => item !== action) : [...actions, action]);
  };

  return (
    <Menu.Root closeOnSelect={false}>
      <Menu.Trigger asChild>
        <Button size="2xs" variant="ghost" gap="xs" color="fg.muted" disabled={disabled}>
          {actions.length} action{actions.length !== 1 ? "s" : ""}
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
    onSetDefault,
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
      <Editable.Root
        // Editable owns its draft text, so a changed source name must remount it for Cancel/reset flows.
        key={value.name}
        flex="1"
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
      {showDefault ? (
        <Button
          size="2xs"
          variant={value.isDefault ? "primary" : "ghost"}
          onClick={onSetDefault}
          disabled={disabled || value.isDefault}
          aria-label={`Set ${value.name} as default`}
        >
          <Icon as={Check} boxSize="icon-xs" />
        </Button>
      ) : null}
      {actionOptions ? (
        <ActionDropdown
          actions={value.actions ?? []}
          disabled={disabled}
          options={actionOptions}
          onChange={onActionsChange}
        />
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
