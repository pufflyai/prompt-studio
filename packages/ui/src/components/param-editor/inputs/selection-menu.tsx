import { Button, Flex, Icon, IconButton, Menu, Portal } from "@chakra-ui/react";
import { Check, ChevronDown, Square, SquareCheck } from "lucide-react";
import type { ReactNode } from "react";
import { ListRow } from "../../list-row/list-row";
import { SearchableMenu, type SearchableMenuItem } from "../../overlays/searchable-menu";
import { getIconComponent } from "../../primitives";
import type { SelectionGroup } from "../param-editor.types";

export interface SelectionMenuOption {
  id: string;
  name: string;
  icon?: string;
  /** Palette key (e.g. "blue") applied to the option's icon. */
  color?: string;
  description?: string;
  disabled?: boolean;
}

export interface SelectionMenuProps {
  triggerLabel: ReactNode;
  options: SelectionMenuOption[];
  selectedIds: string[];
  multiSelect: boolean;
  disabled?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyText?: string;
  group?: SelectionGroup;
  fullWidth?: boolean;
  triggerVariant?: "button" | "icon";
  triggerAriaLabel?: string;
  size?: "xs" | "sm";
  onToggle: (optionId: string) => void;
  onGroupChange?: (optionId: string) => void;
}

export const selectionIndicator = (multiSelect: boolean, selected: boolean) => {
  if (multiSelect)
    return <Icon as={selected ? SquareCheck : Square} boxSize="14px" color={selected ? "fg" : "fg.muted"} />;
  return selected ? <Icon as={Check} boxSize="14px" color="fg" /> : null;
};

export const selectionOptionIcon = (option: SelectionMenuOption | undefined, boxSize: string) => {
  if (!option) return null;
  return (
    <Icon
      as={getIconComponent(option.icon ?? null)}
      boxSize={boxSize}
      color={option.color ? `${option.color}.500` : "fg.muted"}
    />
  );
};

/**
 * The single dropdown behind every option picker in the editor — selection
 * params and editable resource params alike. Sharing it is what keeps a
 * resource attribute and a command param from drifting into two looks.
 *
 * Single-selects clear by re-picking the selected option; a dedicated "none"
 * row would read as just another value to choose.
 */
export const SelectionMenu = (props: SelectionMenuProps) => {
  const {
    triggerLabel,
    options,
    selectedIds,
    multiSelect,
    disabled,
    searchable = false,
    searchPlaceholder = "Search options…",
    emptyText = "No options found",
    group,
    fullWidth,
    triggerVariant = "button",
    triggerAriaLabel,
    size = "sm",
    onToggle,
    onGroupChange,
  } = props;
  const trigger =
    triggerVariant === "icon" ? (
      <IconButton aria-label={triggerAriaLabel ?? "Open options"} size="2xs" variant="ghost" disabled={disabled}>
        {triggerLabel}
      </IconButton>
    ) : (
      <Button
        size={size}
        borderWidth="1px"
        borderStyle="solid"
        borderColor="border"
        disabled={disabled}
        textStyle={size === "xs" ? "label/XS" : "label/S/regular"}
        width={fullWidth ? "100%" : undefined}
        _hover={{ bg: "bg.hover", borderColor: "border.accent-light" }}
        _active={{ bg: "bg.active", borderColor: "border.accent-light" }}
        _expanded={{ bg: "bg.active", borderColor: "border.accent-light" }}
        _focusVisible={{ borderColor: "border.accent-light", outline: "none", boxShadow: "none" }}
      >
        <Flex alignItems="center" justifyContent="space-between" gap="xs" w={fullWidth ? "full" : undefined}>
          <Flex alignItems="center" gap="xs">
            {triggerLabel}
          </Flex>
          <ChevronDown size={14} />
        </Flex>
      </Button>
    );

  if (searchable || group) {
    const items: SearchableMenuItem[] = options.map((option) => ({
      id: option.id,
      label: option.name,
      searchText: [option.id, option.description].filter(Boolean).join(" "),
      secondaryLabel: option.description,
      icon: getIconComponent(option.icon),
      isDisabled: option.disabled,
      isSelected: selectedIds.includes(option.id),
      onSelect: () => onToggle(option.id),
    }));
    const selectedGroup = group?.options.find((option) => option.id === group.defaultValue);

    return (
      <SearchableMenu
        trigger={trigger}
        items={items}
        listId={group?.defaultValue}
        showSearch={searchable}
        searchPlaceholder={searchPlaceholder}
        closeOnSelect={!multiSelect}
        emptyState={
          <Menu.Item value="empty" disabled asChild>
            <ListRow asChild variant="full-width" id="empty" label={emptyText} disabled />
          </Menu.Item>
        }
        parentList={
          group
            ? {
                items: group.options.map((option) => ({
                  id: option.id,
                  label: option.name,
                  searchText: [option.id, option.description].filter(Boolean).join(" "),
                  secondaryLabel: option.description,
                  icon: getIconComponent(option.icon),
                  isDisabled: option.disabled,
                  isSelected: option.id === group.defaultValue,
                })),
                selectedLabel: selectedGroup?.name ?? group.placeholder ?? `Select ${group.name.toLowerCase()}`,
                selectedIcon: selectedGroup ? getIconComponent(selectedGroup.icon) : undefined,
                ariaLabel: group.name,
                disabled: group.disabled || group.options.length <= 1,
                showSearch: group.searchable,
                searchPlaceholder: group.searchPlaceholder ?? `Search ${group.name.toLowerCase()}…`,
                emptyState: (
                  <Menu.Item value="group-empty" disabled asChild>
                    <ListRow
                      asChild
                      variant="full-width"
                      id="group-empty"
                      label={group.emptyText ?? `No ${group.name.toLowerCase()} found`}
                      disabled
                    />
                  </Menu.Item>
                ),
                onSelect: (item) => onGroupChange?.(item.id),
              }
            : undefined
        }
      />
    );
  }

  return (
    <Menu.Root closeOnSelect={!multiSelect}>
      <Menu.Trigger asChild>{trigger}</Menu.Trigger>
      {/* Portaled like every other menu: rendered inline it is clipped by the
          panel's overflow and can extend past the viewport. */}
      <Portal>
        <Menu.Positioner>
          <Menu.Content>
            {options.map((option) => {
              const selected = selectedIds.includes(option.id);
              return (
                <Menu.Item key={option.id} value={option.id} disabled={option.disabled} asChild>
                  <ListRow
                    asChild
                    variant="full-width"
                    role={multiSelect ? "menuitemcheckbox" : "menuitemradio"}
                    aria-checked={selected}
                    id={option.id}
                    label={option.name}
                    icon={selectionOptionIcon(option, "16px")}
                    tooltip={option.description}
                    disabled={option.disabled}
                    isSelected={selected}
                    endContent={selectionIndicator(multiSelect, selected)}
                    onActivate={() => onToggle(option.id)}
                  />
                </Menu.Item>
              );
            })}
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
};
