import { HStack, Icon, Input, Stack, Text } from "@chakra-ui/react";
import type { ViewFilterRule } from "@pstdio/sdk/extensions";
import { useState } from "react";
import { Checkbox } from "@/components/primitives/checkbox";
import { getIconComponent } from "@/components/primitives/icon-options";
import { ScrollArea } from "@/components/primitives/scroll-area";
import type { AttributeDescriptor } from "../kanban-renderer/types";
import { ListRow } from "../list-row/list-row";
import { dayLabel } from "./collection-view-labels";
import { RuleSelect } from "./rule-select";

export interface RuleValueOption {
  value: string;
  label: string;
  count?: number;
  icon?: string | null;
  color?: string;
}

export interface RuleValueProps {
  field: AttributeDescriptor;
  rule: ViewFilterRule;
  options: RuleValueOption[];
  onChange: (value: ViewFilterRule["value"]) => void;
  variant?: "subtle" | "filter-segment";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const RELATIVE_DAYS = ["today", "today-1", "today-7", "today-14", "today-30", "today+1", "today+7"];
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

const valueKind = (field: AttributeDescriptor, rule: ViewFilterRule) => {
  if (rule.condition === "is-empty" || rule.condition === "is-not-empty")
    return ["enum", "enum-multi", "user"].includes(field.type.kind) ? "options" : "none";
  if (Array.isArray(rule.value)) return "options";
  if (field.type.kind === "boolean") return "boolean";
  if (field.type.kind === "number") return "number";
  if (field.type.kind === "date") return "day";
  if (field.type.kind === "string") return "text";
  return "options";
};

const toggle = (values: string[], value: string) =>
  values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value];

const withSavedOptions = (options: RuleValueOption[], rule: ViewFilterRule) => [
  ...options,
  ...listValue(rule)
    .filter((value) => !options.some((option) => option.value === value))
    .map<RuleValueOption>((value) => ({ value, label: value })),
];

const listValue = (rule: ViewFilterRule) => (Array.isArray(rule.value) ? rule.value : []);

const NumberValue = (props: RuleValueProps & { width?: string }) => {
  const { rule, onChange, width } = props;
  return (
    <Input
      aria-label="Value"
      type="number"
      size="2xs"
      width={width}
      value={typeof rule.value === "number" ? String(rule.value) : ""}
      onChange={(event) => onChange(event.target.value === "" ? undefined : Number(event.target.value))}
    />
  );
};

const TextValue = (props: RuleValueProps & { width?: string }) => {
  const { rule, onChange, width } = props;
  return (
    <Input
      aria-label="Value"
      size="2xs"
      width={width}
      value={typeof rule.value === "string" ? rule.value : ""}
      onChange={(event) => onChange(event.target.value)}
    />
  );
};

/** A day relative to today stays current; an exact day stays fixed. */
const DayValue = (props: RuleValueProps) => {
  const { rule, onChange } = props;
  const value = typeof rule.value === "string" ? rule.value : undefined;
  return (
    <HStack gap="2xs" minW="0">
      <RuleSelect
        aria-label="Relative day"
        width="7.5rem"
        placeholder="Relative…"
        options={RELATIVE_DAYS.map((day) => ({ value: day, label: dayLabel(day) }))}
        value={value && !ISO_DAY.test(value) ? value : undefined}
        onSelect={onChange}
      />
      <Input
        aria-label="Exact day"
        type="date"
        size="2xs"
        width="8.5rem"
        value={value && ISO_DAY.test(value) ? value : ""}
        onChange={(event) => onChange(event.target.value || undefined)}
      />
    </HStack>
  );
};

/** The value control inside a rule row. */
export const RuleValueControl = (props: RuleValueProps) => {
  const { field, rule, options: suppliedOptions, onChange } = props;
  const options = withSavedOptions(suppliedOptions, rule);
  const kind = valueKind(field, rule);
  if (kind === "none") return null;
  if (kind === "boolean")
    return (
      <Text textStyle={props.variant === "filter-segment" ? "label/XS" : "label/S/medium"} paddingX="xs">
        {field.label}
      </Text>
    );
  if (kind === "number") return <NumberValue {...props} width="9rem" />;
  if (kind === "text") return <TextValue {...props} width="9rem" />;
  if (kind === "day") return <DayValue {...props} />;
  const selectedLabel = rule.condition === "is-empty" || rule.condition === "is-not-empty" ? "Empty" : undefined;
  const allValuesLabel =
    rule.condition === "has-all-of"
      ? `all of ${options
          .filter((option) => listValue(rule).includes(option.value))
          .map((option) => option.label)
          .join(", ")}`
      : selectedLabel;
  return (
    <RuleSelect
      aria-label="Values"
      selectedLabel={allValuesLabel}
      multiple
      variant={props.variant}
      width={props.variant === "filter-segment" ? undefined : "9rem"}
      open={props.open}
      onOpenChange={props.onOpenChange}
      options={options.map((option) => ({
        ...option,
        icon: option.icon ? getIconComponent(option.icon) : undefined,
        iconColor: option.color ? `${option.color}.500` : undefined,
      }))}
      value={listValue(rule)}
      onSelect={(value) => onChange(toggle(listValue(rule), value))}
    />
  );
};

const OptionChecklist = (props: RuleValueProps) => {
  const { rule, options: suppliedOptions, onChange } = props;
  const options = withSavedOptions(suppliedOptions, rule);
  const [query, setQuery] = useState("");
  const selected = listValue(rule);
  const needle = query.trim().toLocaleLowerCase();
  const visible = options.filter((option) => option.label.toLocaleLowerCase().includes(needle));

  return (
    <Stack gap="0" minH="0">
      <Input
        aria-label="Search options"
        size="2xs"
        variant="borderless"
        placeholder="Search options…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => event.stopPropagation()}
      />
      <ScrollArea maxH="15rem" viewportProps={{ overscrollBehavior: "contain" }}>
        {visible.map((option) => {
          const checked = selected.includes(option.value);
          return (
            <ListRow
              key={option.value}
              id={option.value}
              role="checkbox"
              aria-label={option.label}
              aria-checked={checked}
              variant="compact"
              label={
                <HStack minW="0" gap="xs">
                  <Checkbox
                    checked={checked}
                    readOnly
                    aria-readonly="true"
                    inputProps={{ tabIndex: -1, "aria-hidden": true }}
                    pointerEvents="none"
                    size="sm"
                  />
                  {option.icon ? (
                    <Icon
                      as={getIconComponent(option.icon)}
                      boxSize="3"
                      color={option.color ? `${option.color}.500` : "fg.muted"}
                    />
                  ) : null}
                  <Text textStyle="label/S/regular" truncate>
                    {option.label}
                  </Text>
                </HStack>
              }
              endContent={
                option.count === undefined ? undefined : (
                  <Text textStyle="label/XS" color="fg.muted">
                    {option.count}
                  </Text>
                )
              }
              onActivate={() => onChange(toggle(selected, option.value))}
            />
          );
        })}
      </ScrollArea>
    </Stack>
  );
};

/** The value control inside the rule editor and the quick picker. */
export const RuleValueEditor = (props: RuleValueProps) => {
  const { field, rule } = props;
  const kind = valueKind(field, rule);
  if (kind === "none") return null;
  if (kind === "boolean")
    return (
      <Text textStyle="label/S/medium" paddingX="xs">
        {field.label}
      </Text>
    );
  if (kind === "options") return <OptionChecklist {...props} />;
  if (kind === "day") return <DayValue {...props} />;
  if (kind === "number") return <NumberValue {...props} />;
  return <TextValue {...props} />;
};
