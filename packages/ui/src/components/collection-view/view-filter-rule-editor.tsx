import { HStack, Icon, IconButton, Menu, Stack, Text } from "@chakra-ui/react";
import type { ViewFilterCondition, ViewFilterRule } from "@pstdio/sdk/extensions";
import { ListFilter, MoreHorizontal, Trash2 } from "lucide-react";
import type { AttributeDescriptor } from "../kanban-renderer/types";
import { useCollectionItemLabel } from "./collection-item-label";
import { fieldConditions } from "./collection-view-fields";
import { conditionLabel } from "./collection-view-labels";
import { RuleValueEditor, type RuleValueOption } from "./filter-rule-value";
import { RuleSelect } from "./rule-select";

export interface ViewFilterRuleEditorProps {
  field: AttributeDescriptor;
  rule: ViewFilterRule;
  options: RuleValueOption[];
  onChange: (rule: ViewFilterRule) => void;
  onDelete: () => void;
  onOpenAdvanced?: () => void;
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
}) => {
  const { field, rule, width, onChange } = props;
  const boolean = field.type.kind === "boolean";
  let condition = rule.condition;
  if (boolean && rule.value === false) {
    if (rule.condition === "is") condition = "is-not";
    if (rule.condition === "is-not") condition = "is";
  }
  return (
    <RuleSelect
      aria-label="Condition"
      width={width}
      options={fieldConditions(field).map((condition) => ({
        value: condition,
        label: conditionLabel(condition, field),
      }))}
      value={condition}
      onSelect={(next) => {
        if (next === condition && (!boolean || typeof rule.value === "boolean")) return;
        const selectedCondition = next as ViewFilterCondition;
        const updated = changeCondition(rule, selectedCondition);
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
  const { field, rule, options, onChange, onDelete, onOpenAdvanced } = props;
  const itemLabel = useCollectionItemLabel();

  return (
    <Stack data-testid="view-filter-rule-editor" gap="2xs" minW="0">
      <HStack gap="xs" paddingX="xs" paddingTop="2xs">
        <Text textStyle="label/S/regular" color="fg.muted" flexShrink={0}>
          {field.type.kind === "boolean" && typeof rule.value === "boolean" ? itemLabel : field.label}
        </Text>
        <ConditionSelect field={field} rule={rule} onChange={onChange} />
        <Menu.Root positioning={{ placement: "bottom-end" }}>
          <Menu.Trigger asChild>
            <IconButton aria-label="Filter actions" variant="ghost" size="2xs" marginLeft="auto">
              <Icon as={MoreHorizontal} />
            </IconButton>
          </Menu.Trigger>
          <Menu.Positioner>
            <Menu.Content>
              <Menu.Item value="delete" onClick={onDelete}>
                <Icon as={Trash2} boxSize="0.875rem" />
                Delete filter
              </Menu.Item>
              {onOpenAdvanced ? (
                <Menu.Item value="advanced" onClick={onOpenAdvanced}>
                  <Icon as={ListFilter} boxSize="0.875rem" />
                  Move to advanced filter
                </Menu.Item>
              ) : null}
            </Menu.Content>
          </Menu.Positioner>
        </Menu.Root>
      </HStack>
      <RuleValueEditor field={field} rule={rule} options={options} onChange={(value) => onChange({ ...rule, value })} />
    </Stack>
  );
};
