import { HStack, Icon, IconButton, Stack, Text } from "@chakra-ui/react";
import type { ViewFilterCondition, ViewFilterRule } from "@pstdio/sdk/extensions";
import { X } from "lucide-react";
import type { AttributeDescriptor } from "../kanban-renderer/types";
import { useCollectionItemLabel } from "./collection-item-label";
import { fieldConditions } from "./collection-view-fields";
import { conditionLabel } from "./collection-view-labels";
import { selectRuleValues } from "./collection-view-rules";
import { RuleValueEditor, type RuleValueOption } from "./filter-rule-value";
import { RuleSelect } from "./rule-select";

export interface ViewFilterRuleEditorProps {
  field: AttributeDescriptor;
  rule: ViewFilterRule;
  options: RuleValueOption[];
  onChange: (rule: ViewFilterRule) => void;
  onDelete: () => void;
}

/**
 * Every condition of a field that takes a value takes the same kind of value, so changing the
 * condition keeps it and "is any of" turns into "is none of" in one step.
 */
export const changeCondition = (rule: ViewFilterRule, condition: ViewFilterCondition): ViewFilterRule => {
  if (condition === "is-empty" || condition === "is-not-empty") return { attributeId: rule.attributeId, condition };
  return { ...rule, condition };
};

export const ConditionSelect = (props: {
  field: AttributeDescriptor;
  rule: ViewFilterRule;
  width?: string;
  onChange: (rule: ViewFilterRule) => void;
  variant?: "subtle" | "filter-segment";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) => {
  const { field, rule, width, onChange } = props;
  const boolean = field.type.kind === "boolean";
  const optionField = ["enum", "enum-multi", "user"].includes(field.type.kind);
  const listRule = optionField || Array.isArray(rule.value);
  if (listRule) {
    const empty = rule.condition === "is-empty" || rule.condition === "is-not-empty";
    const negative = ["is-none-of", "has-none-of", "is-not-empty"].includes(rule.condition);
    const positiveCondition = field.type.kind === "enum-multi" ? "has-any-of" : "is-any-of";
    const negativeCondition = field.type.kind === "enum-multi" ? "has-none-of" : "is-none-of";
    return (
      <RuleSelect
        aria-label="Condition"
        width={width}
        variant={props.variant}
        options={[
          { value: "is", label: "is" },
          { value: "is-not", label: "is not" },
        ]}
        value={negative ? "is-not" : "is"}
        onSelect={(next) => {
          if (next === (negative ? "is-not" : "is")) return;
          if (empty) {
            onChange({ attributeId: rule.attributeId, condition: next === "is" ? "is-empty" : "is-not-empty" });
            return;
          }
          onChange({ ...rule, condition: next === "is" ? positiveCondition : negativeCondition });
        }}
      />
    );
  }
  let condition = rule.condition;
  if (boolean && rule.value === false) {
    if (rule.condition === "is") condition = "is-not";
    if (rule.condition === "is-not") condition = "is";
  }
  const conditions: readonly ViewFilterCondition[] = boolean ? ["is", "is-not"] : fieldConditions(field);
  const choices = conditions.includes(rule.condition) ? conditions : [rule.condition, ...conditions];
  return (
    <RuleSelect
      aria-label="Condition"
      variant={props.variant}
      open={props.open}
      onOpenChange={props.onOpenChange}
      width={width}
      options={choices.map((condition) => ({
        value: condition,
        label: conditionLabel(condition, field),
      }))}
      value={condition}
      onSelect={(next) => {
        if (next === condition && (!boolean || typeof rule.value === "boolean")) return;
        const selectedCondition = next as ViewFilterCondition;
        const source =
          !conditions.includes(rule.condition) && Array.isArray(rule.value)
            ? { attributeId: rule.attributeId, condition: rule.condition }
            : rule;
        const updated = changeCondition(source, selectedCondition);
        if (boolean && (selectedCondition === "is" || selectedCondition === "is-not")) {
          const negative = rule.condition === "is-not";
          onChange({
            attributeId: rule.attributeId,
            condition: negative ? "is-not" : "is",
            value: negative ? selectedCondition === "is-not" : selectedCondition === "is",
          });
          return;
        }
        onChange(updated);
      }}
    />
  );
};

/** Opens from a filter pill and edits that one rule in place. */
export const ViewFilterRuleEditor = (props: ViewFilterRuleEditorProps) => {
  const { field, rule, options, onChange, onDelete } = props;
  const itemLabel = useCollectionItemLabel();

  return (
    <Stack data-testid="view-filter-rule-editor" gap="2xs" minW="0">
      <HStack gap="xs" paddingX="xs" paddingTop="2xs">
        <Text textStyle="label/S/regular" color="fg.muted" flexShrink={0}>
          {field.type.kind === "boolean" && typeof rule.value === "boolean" ? itemLabel : field.label}
        </Text>
        <ConditionSelect field={field} rule={rule} onChange={onChange} />
        <IconButton aria-label="Remove filter" variant="ghost" size="2xs" marginLeft="auto" onClick={onDelete}>
          <Icon as={X} />
        </IconButton>
      </HStack>
      <RuleValueEditor
        field={field}
        rule={rule}
        options={options}
        onChange={(value) => onChange(selectRuleValues(field, rule, value))}
      />
    </Stack>
  );
};
