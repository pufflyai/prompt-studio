import { Button, Editable, Flex, Icon, Menu, Table } from "@chakra-ui/react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, ChevronDown, GripVertical, Trash2 } from "lucide-react";

import { IconColorPicker } from "../icon-color-picker";
import { ListRow } from "../list-row/list-row";
import type { StatusOptionEditorAction, StatusOptionEditorItem } from "./status-option-editor.types";

interface StatusOptionRowProps {
  actionOptions?: StatusOptionEditorAction[];
  item: StatusOptionEditorItem;
  isSaving?: boolean;
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
  options: StatusOptionEditorAction[];
  onChange: (actions: string[]) => void;
}) => {
  const { actions, disabled, options, onChange } = props;

  const toggleAction = (action: string) => {
    onChange(actions.includes(action) ? actions.filter((item) => item !== action) : [...actions, action]);
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
          {options.map((option) => (
            <Menu.Item key={option.value} value={option.value} asChild>
              <ListRow
                asChild
                variant="compact"
                id={option.value}
                label={option.label}
                isSelected={actions.includes(option.value)}
                onActivate={() => toggleAction(option.value)}
              />
            </Menu.Item>
          ))}
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
  );
};

export const StatusOptionRow = (props: StatusOptionRowProps) => {
  const {
    actionOptions,
    item,
    isSaving,
    showDefault,
    showIcons,
    onActionsChange,
    onColorChange,
    onDelete,
    onIconChange,
    onNameChange,
    onSetDefault,
  } = props;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });

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
          defaultValue={item.name}
          onValueCommit={(details) => {
            const trimmed = details.value.trim();
            if (trimmed && trimmed !== item.name) onNameChange(trimmed);
          }}
        >
          <Editable.Preview />
          <Editable.Input />
        </Editable.Root>
      </Table.Cell>
      <Table.Cell width="54px">
        <IconColorPicker
          color={item.color}
          icon={item.icon}
          showIcons={showIcons}
          onColorChange={onColorChange}
          onIconChange={onIconChange}
          disabled={isSaving}
        />
      </Table.Cell>
      {showDefault ? (
        <Table.Cell width="80px">
          <Button
            size="2xs"
            variant={item.isDefault ? "solid" : "ghost"}
            onClick={onSetDefault}
            disabled={isSaving || item.isDefault}
            aria-label={`Set ${item.name} as default`}
          >
            <Check size={14} />
          </Button>
        </Table.Cell>
      ) : null}
      {actionOptions ? (
        <Table.Cell width="140px">
          <ActionDropdown
            actions={item.actions ?? []}
            disabled={isSaving}
            options={actionOptions}
            onChange={onActionsChange}
          />
        </Table.Cell>
      ) : null}
      <Table.Cell width="40px">
        <Button
          size="2xs"
          variant="ghost"
          colorPalette="red"
          onClick={onDelete}
          disabled={isSaving || item.isDefault}
          aria-label={`Delete ${item.name}`}
        >
          <Trash2 size={14} />
        </Button>
      </Table.Cell>
    </Table.Row>
  );
};
