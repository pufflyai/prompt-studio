import { Box, Flex } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import type { SelectionGroup } from "../param-editor.types";
import { ParamEditorLabel } from "../param-editor-label";
import { ParamEditorReadOnlyValue } from "../param-editor-read-only-value";
import { SelectionMenu, type SelectionMenuOption, selectionOptionIcon } from "./selection-menu";

interface SelectionInputProps {
  id: string;
  defaultValue: string | string[];
  name: string;
  options: SelectionMenuOption[];
  onChange: (id: string, value: string | string[]) => void;
  description: string;
  readOnly?: boolean;
  hideLabel?: boolean;
  multiSelect?: boolean;
  tooltipPlacement?: "top" | "right" | "bottom" | "left";
  placeholder?: string;
  fullWidth?: boolean;
  /** Re-picking the selected option clears it. */
  clearable?: boolean;
  /** Inert, but still rendered as a control. */
  disabled?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyText?: string;
  group?: SelectionGroup;
  size?: "xs" | "sm";
}

export const SelectionInput = (props: SelectionInputProps) => {
  const {
    id,
    defaultValue,
    name,
    options,
    onChange,
    description,
    readOnly,
    hideLabel = false,
    multiSelect = false,
    placeholder,
    fullWidth = false,
    clearable = false,
    disabled = false,
    searchable = false,
    searchPlaceholder,
    emptyText,
    group,
    size = "sm",
  } = props;
  const [value, setValue] = useState(defaultValue);
  const [groupValue, setGroupValue] = useState(group?.defaultValue ?? "");

  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  useEffect(() => {
    setGroupValue(group?.defaultValue ?? "");
  }, [group?.defaultValue]);

  const selectedIds = multiSelect
    ? Array.isArray(value)
      ? value
      : []
    : typeof value === "string" && value
      ? [value]
      : [];

  const getDisplayText = () => {
    const names = selectedIds
      .map((selectedId) => options.find((option) => option.id === selectedId)?.name)
      .filter((optionName): optionName is string => Boolean(optionName));

    if (names.length === 0) return placeholder || "Select";
    if (names.length <= 3) return names.join(", ");
    return `${names.slice(0, 3).join(", ")} +${(names.length - 3).toString()}`;
  };

  const commit = (nextValue: string | string[]) => {
    setValue(nextValue);
    onChange(id, nextValue);
  };

  const handleToggle = (optionId: string) => {
    if (!multiSelect) {
      // Re-picking the selected option clears it, so a single-select needs no
      // extra "none" row cluttering the list.
      commit(clearable && selectedIds.includes(optionId) ? "" : optionId);
      return;
    }
    commit(
      selectedIds.includes(optionId) ? selectedIds.filter((item) => item !== optionId) : [...selectedIds, optionId],
    );
  };

  const handleGroupChange = (optionId: string) => {
    if (!group || optionId === groupValue) return;
    setGroupValue(optionId);
    onChange(group.id, optionId);
  };

  // Only a lone selection can colour the trigger; a multi-pick has no single icon.
  const triggerOption = selectedIds.length === 1 ? options.find((option) => option.id === selectedIds[0]) : undefined;
  const label = !hideLabel ? <ParamEditorLabel name={name} description={description} /> : null;

  if (readOnly) {
    const valueElement = <ParamEditorReadOnlyValue>{getDisplayText()}</ParamEditorReadOnlyValue>;

    if (fullWidth)
      return (
        <Box>
          {label ? <Box mb="xs">{label}</Box> : null}
          {valueElement}
        </Box>
      );

    return (
      <Box>
        <Flex alignItems="center" justifyContent="space-between" minHeight="2rem" gap="xs">
          {label}
          {valueElement}
        </Flex>
      </Box>
    );
  }

  const menu = (
    <SelectionMenu
      triggerLabel={
        <>
          {selectionOptionIcon(triggerOption, "14px")}
          {getDisplayText()}
        </>
      }
      options={options}
      selectedIds={selectedIds}
      multiSelect={multiSelect}
      disabled={disabled}
      searchable={searchable}
      searchPlaceholder={searchPlaceholder}
      emptyText={emptyText}
      group={group ? { ...group, defaultValue: groupValue } : undefined}
      fullWidth={fullWidth}
      size={size}
      onToggle={handleToggle}
      onGroupChange={handleGroupChange}
    />
  );

  if (fullWidth)
    return (
      <Box>
        {label ? <Box mb="xs">{label}</Box> : null}
        {menu}
      </Box>
    );

  return (
    <Box>
      <Flex alignItems="center" justifyContent="space-between" minHeight="2rem" gap="xs">
        {label}
        {menu}
      </Flex>
    </Box>
  );
};
