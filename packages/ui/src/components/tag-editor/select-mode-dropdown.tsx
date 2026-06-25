import { Button, Icon, Menu } from "@chakra-ui/react";
import { Check, ChevronDown } from "lucide-react";

import { ListRow } from "../list-row/list-row";
import type { TagEditorSelectMode } from "./tag-editor.types";

const SELECT_MODE_OPTIONS = [
  { value: "single", label: "Single" },
  { value: "multiple", label: "Multiple" },
] satisfies Array<{ value: TagEditorSelectMode; label: string }>;

export const getSelectModeLabel = (selectMode: TagEditorSelectMode) =>
  SELECT_MODE_OPTIONS.find((option) => option.value === selectMode)?.label ?? SELECT_MODE_OPTIONS[0].label;

interface SelectModeDropdownProps {
  selectMode: TagEditorSelectMode;
  disabled?: boolean;
  label?: string;
  onChange: (selectMode: TagEditorSelectMode) => void;
}

export const SelectModeDropdown = (props: SelectModeDropdownProps) => {
  const { selectMode, disabled, label, onChange } = props;

  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <Button size="2xs" variant="outline" gap="xs" disabled={disabled} aria-label={label}>
          {getSelectModeLabel(selectMode)}
          <Icon as={ChevronDown} boxSize="12px" />
        </Button>
      </Menu.Trigger>
      <Menu.Positioner>
        <Menu.Content minW="140px" bg="bg">
          {SELECT_MODE_OPTIONS.map((option) => (
            <Menu.Item key={option.value} value={option.value} asChild>
              <ListRow
                asChild
                variant="compact"
                id={option.value}
                label={option.label}
                isSelected={selectMode === option.value}
                endContent={selectMode === option.value ? <Check size={14} /> : undefined}
                onActivate={() => onChange(option.value)}
              />
            </Menu.Item>
          ))}
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
  );
};
