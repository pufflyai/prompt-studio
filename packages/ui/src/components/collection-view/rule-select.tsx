import { Button, Icon, Text } from "@chakra-ui/react";
import { ChevronDown } from "lucide-react";
import type { ElementType } from "react";
import { SearchableMenu } from "@/components/overlays/searchable-menu";

export interface RuleSelectOption {
  value: string;
  label: string;
  icon?: ElementType;
  iconColor?: string;
  count?: number;
  disabled?: boolean;
}

export interface RuleSelectProps {
  "aria-label": string;
  options: RuleSelectOption[];
  /** One value, or several when `multiple` is set. */
  value: string | string[] | undefined;
  onSelect: (value: string) => void;
  multiple?: boolean;
  placeholder?: string;
  selectedLabel?: string;
  /** Rule rows pass a fixed width so the columns of a rule list line up. */
  width?: string;
  showSearch?: boolean;
  variant?: "subtle" | "filter-segment" | "filter-condition" | "outline";
  size?: "2xs" | "sm";
  showSelectedIcon?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
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
      open={props.open}
      onOpenChange={props.onOpenChange ? (details) => props.onOpenChange?.(details.open) : undefined}
      positioning={{ strategy: "fixed", hideWhenDetached: true }}
      multiple={multiple}
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
        iconColor: option.iconColor,
        variant: "compact",
        secondaryLabel: option.count && option.count > 0 ? String(option.count) : undefined,
        isDisabled: option.disabled,
        isSelected: selected.includes(option.value),
        onSelect: () => onSelect(option.value),
      }))}
      trigger={
        <Button
          aria-label={props["aria-label"]}
          variant={props.variant ?? "subtle"}
          size={props.size ?? "2xs"}
          width={width}
          minW="0"
          justifyContent="flex-start"
          gap="2xs"
          flexShrink={0}
        >
          {icon && props.showSelectedIcon !== false ? (
            <Icon as={icon} color={selectedOptions[0]?.iconColor ?? "fg.muted"} />
          ) : null}
          <Text
            as="span"
            flex="1"
            minW="0"
            textAlign="start"
            textStyle={props.size === "sm" ? "label/S/regular" : "label/XS"}
            truncate
          >
            {props.selectedLabel ?? label}
          </Text>
          {props.variant !== "filter-segment" && props.variant !== "filter-condition" ? (
            <Icon as={ChevronDown} color="fg.subtle" />
          ) : null}
        </Button>
      }
    />
  );
};
