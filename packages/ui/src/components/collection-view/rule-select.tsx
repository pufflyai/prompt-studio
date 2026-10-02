import { Button, Icon, Text } from "@chakra-ui/react";
import { ChevronDown } from "lucide-react";
import type { ElementType } from "react";
import { SearchableMenu } from "@/components/overlays/searchable-menu";

export interface RuleSelectOption {
  value: string;
  label: string;
  icon?: ElementType;
}

export interface RuleSelectProps {
  "aria-label": string;
  options: RuleSelectOption[];
  /** One value, or several when `multiple` is set. */
  value: string | string[] | undefined;
  onSelect: (value: string) => void;
  multiple?: boolean;
  placeholder?: string;
  /** Rule rows pass a fixed width so the columns of a rule list line up. */
  width?: string;
  showSearch?: boolean;
}

const toList = (value: RuleSelectProps["value"]) => {
  if (Array.isArray(value)) return value;
  return value === undefined ? [] : [value];
};

/** Compact select used inside filter and sort rules. */
export const RuleSelect = (props: RuleSelectProps) => {
  const { options, value, onSelect, multiple = false, placeholder = "Choose…", width, showSearch } = props;
  const selected = toList(value);
  const selectedOptions = options.filter((option) => selected.includes(option.value));
  const label = selectedOptions.map((option) => option.label).join(", ") || placeholder;
  const icon = selectedOptions.length === 1 ? selectedOptions[0]?.icon : undefined;

  return (
    <SearchableMenu
      portalled={false}
      closeOnSelect={!multiple}
      showSearch={showSearch ?? options.length > 8}
      searchPlaceholder="Search…"
      emptyState={
        <Text textStyle="label/S/regular" color="fg.muted" padding="xs">
          No matches
        </Text>
      }
      width="14rem"
      items={options.map((option) => ({
        id: option.value,
        label: option.label,
        icon: option.icon,
        isSelected: selected.includes(option.value),
        onSelect: () => onSelect(option.value),
      }))}
      trigger={
        <Button
          aria-label={props["aria-label"]}
          variant="subtle"
          size="2xs"
          width={width}
          minW="0"
          justifyContent="flex-start"
          gap="2xs"
          flexShrink={0}
        >
          {icon ? <Icon as={icon} color="fg.muted" /> : null}
          <Text as="span" flex="1" minW="0" textAlign="start" textStyle="label/XS" truncate>
            {label}
          </Text>
          <Icon as={ChevronDown} color="fg.subtle" />
        </Button>
      }
    />
  );
};
