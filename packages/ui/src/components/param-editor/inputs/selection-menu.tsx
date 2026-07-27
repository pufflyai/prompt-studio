import { Button, Flex, Icon, Menu } from "@chakra-ui/react";
import { Check, ChevronDown, Square, SquareCheck } from "lucide-react";
import type { ReactNode } from "react";
import { ListRow } from "../../list-row/list-row";
import { getIconComponent } from "../../primitives";

export interface SelectionMenuOption {
  id: string;
  name: string;
  icon?: string;
  /** Palette key (e.g. "blue") applied to the option's icon. */
  color?: string;
  description?: string;
}

export interface SelectionMenuProps {
  triggerLabel: ReactNode;
  options: SelectionMenuOption[];
  selectedIds: string[];
  multiSelect: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  onToggle: (optionId: string) => void;
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
  const { triggerLabel, options, selectedIds, multiSelect, disabled, fullWidth, onToggle } = props;

  return (
    <Menu.Root closeOnSelect={!multiSelect}>
      <Menu.Trigger asChild>
        <Button
          size="sm"
          borderWidth="1px"
          borderStyle="solid"
          borderColor="border"
          disabled={disabled}
          textStyle="label/S/regular"
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
      </Menu.Trigger>
      <Menu.Positioner>
        <Menu.Content>
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
                  icon={selectionOptionIcon(option, "16px")}
                  tooltip={option.description}
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
