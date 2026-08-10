import { Box, Flex, Icon, Stack } from "@chakra-ui/react";
import { Plus } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { getIconComponent } from "../../primitives/icon-options";
import type { ResourceOption, ResourceRefValue } from "../param-editor.types";
import { ParamEditorLabel } from "../param-editor-label";
import { ResourceChipList } from "./resource-input-chips";
import { SelectionMenu } from "./selection-menu";

interface ResourceInputProps {
  id: string;
  name: string;
  description?: string;
  defaultValue: string | string[];
  options: ResourceOption[];
  onChange: (id: string, value: string | string[]) => void;
  onOpenResource?: (ref: ResourceRefValue) => void;
  readOnly?: boolean;
  editable?: boolean;
  multiSelect?: boolean;
  placeholder?: string;
  emptyText?: string;
  fullWidth?: boolean;
  presentation?: "stacked" | "horizontal";
  size?: "xs" | "sm";
}

const toIds = (value: string | string[]) => {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
};

const resolveOptions = (ids: string[], options: ResourceOption[]) =>
  ids
    .map((id) => options.find((option) => option.id === id))
    .filter((option): option is ResourceOption => Boolean(option));

interface FieldShellProps {
  fullWidth: boolean;
  label: ReactNode;
  control: ReactNode;
  presentation: "stacked" | "horizontal";
}

const FieldShell = (props: FieldShellProps) => {
  const { fullWidth, label, control, presentation } = props;

  if (presentation === "horizontal") {
    return (
      <Stack gap="2xs" alignItems="start" minW="0">
        {label}
        {control}
      </Stack>
    );
  }

  if (fullWidth) {
    return (
      <Box>
        <Box mb="xs">{label}</Box>
        {control}
      </Box>
    );
  }

  return (
    <Flex alignItems="center" justifyContent="space-between" minHeight="2rem" gap="xs">
      {label}
      {control}
    </Flex>
  );
};

interface ResourceSelectMenuProps {
  triggerLabel: ReactNode;
  options: ResourceOption[];
  selectedIds: string[];
  multiSelect: boolean;
  triggerVariant?: "button" | "icon";
  triggerAriaLabel?: string;
  size?: "xs" | "sm";
  onToggle: (optionId: string) => void;
}

// Resource params share the editor's one dropdown, so a ticket property and a
// command param cannot drift into two looks.
const ResourceSelectMenu = (props: ResourceSelectMenuProps) => {
  const { triggerLabel, options, selectedIds, multiSelect, triggerVariant, triggerAriaLabel, size, onToggle } = props;

  return (
    <SelectionMenu
      triggerLabel={triggerLabel}
      options={options}
      selectedIds={selectedIds}
      multiSelect={multiSelect}
      triggerVariant={triggerVariant}
      triggerAriaLabel={triggerAriaLabel}
      size={size}
      onToggle={onToggle}
    />
  );
};

export const ResourceInput = (props: ResourceInputProps) => {
  const {
    id,
    name,
    description,
    defaultValue,
    options,
    onChange,
    onOpenResource,
    readOnly,
    editable = false,
    multiSelect = false,
    placeholder,
    emptyText,
    fullWidth = false,
    presentation = "stacked",
    size = "sm",
  } = props;

  const [value, setValue] = useState(defaultValue);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  const emitChange = (next: string | string[]) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    onChange(id, next);
  };

  // Debounce multi-select toggles so a burst of menu clicks makes one update call.
  const scheduleChange = (next: string | string[]) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => onChange(id, next), 540);
  };

  const selectedIds = toIds(value);
  const selectedOptions = resolveOptions(selectedIds, options);
  const interactive = editable && !readOnly;

  const label = <ParamEditorLabel name={name} description={description} compact={presentation === "horizontal"} />;

  if (!interactive) {
    return (
      <FieldShell
        fullWidth={fullWidth}
        label={label}
        presentation={presentation}
        control={<ResourceChipList options={selectedOptions} onOpenResource={onOpenResource} emptyText={emptyText} />}
      />
    );
  }

  const toggleOption = (optionId: string) => {
    if (multiSelect) {
      const next = selectedIds.includes(optionId)
        ? selectedIds.filter((entry) => entry !== optionId)
        : [...selectedIds, optionId];
      setValue(next);
      scheduleChange(next);
      return;
    }
    // Re-picking the selected option clears it.
    const next = selectedIds.includes(optionId) ? "" : optionId;
    setValue(next);
    emitChange(next);
  };

  const removeOption = (optionId: string) => {
    const next = selectedIds.filter((entry) => entry !== optionId);
    setValue(next);
    scheduleChange(next);
  };

  if (multiSelect) {
    const control = (
      <Flex gap="2xs" alignItems="center" flexWrap="wrap" minW="0">
        {selectedOptions.length > 0 ? (
          <ResourceChipList
            options={selectedOptions}
            onOpenResource={onOpenResource}
            onRemove={removeOption}
            emptyText={emptyText}
          />
        ) : null}
        <ResourceSelectMenu
          triggerLabel={<Icon as={Plus} boxSize="12px" />}
          options={options}
          selectedIds={selectedIds}
          multiSelect
          triggerVariant="icon"
          triggerAriaLabel={placeholder ?? `Add ${name}`}
          size={size}
          onToggle={toggleOption}
        />
      </Flex>
    );

    return <FieldShell fullWidth={fullWidth} label={label} control={control} presentation={presentation} />;
  }

  const selected = selectedOptions[0];
  const triggerLabel = selected ? (
    <Flex align="center" gap="2xs" minW="0">
      <Icon
        as={getIconComponent(selected.icon)}
        boxSize="14px"
        color={selected.color ? `${selected.color}.500` : "fg.muted"}
      />
      {selected.name}
    </Flex>
  ) : (
    (placeholder ?? "Select")
  );

  return (
    <FieldShell
      fullWidth={fullWidth}
      label={label}
      presentation={presentation}
      control={
        <ResourceSelectMenu
          triggerLabel={triggerLabel}
          options={options}
          selectedIds={selectedIds}
          multiSelect={false}
          size={size}
          onToggle={toggleOption}
        />
      }
    />
  );
};
