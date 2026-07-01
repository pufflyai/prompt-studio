import { Box, Button, Flex, Icon, Menu } from "@chakra-ui/react";
import { Check, ChevronDown, Plus, Square, SquareCheck, X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { ListRow } from "../../list-row/list-row";
import { getIconComponent } from "../../primitives/icon-color-picker";
import type { ResourceOption, ResourceRefValue } from "../param-editor.types";
import { ParamEditorLabel } from "../param-editor-label";
import { ResourceChipList } from "./resource-input-chips";

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
}

const toIds = (value: string | string[]) => {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
};

const resolveOptions = (ids: string[], options: ResourceOption[]) =>
  ids
    .map((id) => options.find((option) => option.id === id))
    .filter((option): option is ResourceOption => Boolean(option));

const FieldShell = (props: { fullWidth: boolean; label: ReactNode; control: ReactNode }) => {
  const { fullWidth, label, control } = props;

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
  name: string;
  emptyText?: string;
  onToggle: (optionId: string) => void;
  onClear: () => void;
}

const selectionIndicator = (multiSelect: boolean, selected: boolean) => {
  if (multiSelect)
    return <Icon as={selected ? SquareCheck : Square} boxSize="14px" color={selected ? "fg" : "fg.muted"} />;
  return selected ? <Icon as={Check} boxSize="14px" color="fg" /> : null;
};

const ResourceSelectMenu = (props: ResourceSelectMenuProps) => {
  const { triggerLabel, options, selectedIds, multiSelect, name, emptyText, onToggle, onClear } = props;
  const noneSelected = selectedIds.length === 0;

  return (
    <Menu.Root closeOnSelect={!multiSelect}>
      <Menu.Trigger asChild>
        <Button size="xs" variant="subtle" gap="2xs" justifyContent="space-between">
          {triggerLabel}
          <Icon as={ChevronDown} boxSize="12px" color="fg.muted" />
        </Button>
      </Menu.Trigger>
      <Menu.Positioner>
        <Menu.Content bg="bg">
          {!multiSelect ? (
            <Menu.Item value="__clear" asChild>
              <ListRow
                asChild
                variant="full-width"
                role="menuitemradio"
                aria-checked={noneSelected}
                id="__clear"
                label={emptyText ?? `No ${name}`}
                icon={<Icon as={X} boxSize="16px" />}
                iconColor="gray.500"
                isSelected={noneSelected}
                endContent={selectionIndicator(false, noneSelected)}
                onActivate={onClear}
              />
            </Menu.Item>
          ) : null}
          {options.map((option) => {
            const selected = selectedIds.includes(option.id);
            return (
              <Menu.Item key={option.id} value={option.id} asChild>
                <ListRow
                  asChild
                  variant="full-width"
                  role={multiSelect ? "menuitemcheckbox" : "menuitemradio"}
                  aria-checked={selected}
                  id={option.id}
                  label={option.name}
                  icon={<Icon as={getIconComponent(option.icon)} boxSize="16px" />}
                  iconColor={`${option.color ?? "gray"}.500`}
                  tooltip={option.description ?? undefined}
                  isSelected={selected}
                  endContent={selectionIndicator(multiSelect, selected)}
                  onActivate={() => onToggle(option.id)}
                />
              </Menu.Item>
            );
          })}
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
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

  const label = <ParamEditorLabel name={name} description={description} />;

  if (!interactive) {
    return (
      <FieldShell
        fullWidth={fullWidth}
        label={label}
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
    setValue(optionId);
    emitChange(optionId);
  };

  const removeOption = (optionId: string) => {
    const next = selectedIds.filter((entry) => entry !== optionId);
    setValue(next);
    scheduleChange(next);
  };

  const clearSelection = () => {
    const next = multiSelect ? [] : "";
    setValue(next);
    emitChange(next);
  };

  if (multiSelect) {
    const control = (
      <Flex direction="column" gap="2xs" align="flex-start" minW="0">
        {selectedOptions.length > 0 ? (
          <ResourceChipList
            options={selectedOptions}
            onOpenResource={onOpenResource}
            onRemove={removeOption}
            emptyText={emptyText}
          />
        ) : null}
        <ResourceSelectMenu
          triggerLabel={
            <Flex align="center" gap="2xs">
              <Icon as={Plus} boxSize="12px" />
              {placeholder ?? "Add"}
            </Flex>
          }
          options={options}
          selectedIds={selectedIds}
          multiSelect
          name={name}
          emptyText={emptyText}
          onToggle={toggleOption}
          onClear={clearSelection}
        />
      </Flex>
    );

    return <FieldShell fullWidth={fullWidth} label={label} control={control} />;
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
      control={
        <ResourceSelectMenu
          triggerLabel={triggerLabel}
          options={options}
          selectedIds={selectedIds}
          multiSelect={false}
          name={name}
          emptyText={emptyText}
          onToggle={toggleOption}
          onClear={clearSelection}
        />
      }
    />
  );
};
