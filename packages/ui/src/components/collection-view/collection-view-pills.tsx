import { HStack, Icon, IconButton, Text } from "@chakra-ui/react";
import { normalizeBooleanViewRule, type ViewFilterRule } from "@pstdio/sdk/extensions";
import { X } from "lucide-react";
import type { AttributeDescriptor } from "../kanban-renderer/types";
import { useCollectionItemLabel } from "./collection-item-label";
import { findField } from "./collection-view-fields";
import { selectRuleValues } from "./collection-view-rules";
import { RuleValueControl, type RuleValueOption } from "./filter-rule-value";
import { ConditionSelect } from "./view-filter-rule-editor";

export interface FilterRulePillProps {
  fields: AttributeDescriptor[];
  rule: ViewFilterRule;
  options: RuleValueOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (rule: ViewFilterRule) => void;
  onRemove: () => void;
}

/** Each part of a filter can be changed without opening another editor. */
export const FilterRulePill = (props: FilterRulePillProps) => {
  const { fields, rule: savedRule, options, open, onOpenChange, onChange, onRemove } = props;
  const field = findField(fields, savedRule.attributeId);
  const rule = field ? normalizeBooleanViewRule(savedRule, field.type) : savedRule;
  const itemLabel = useCollectionItemLabel();
  const label = field?.label ?? rule.attributeId;
  const boolean = field?.type.kind === "boolean";
  return (
    <HStack role="group" aria-label={`${label} filter`} layerStyle="filterPill" gap="0" flexShrink={0}>
      <Text as="span" textStyle="label/XS" layerStyle="filterLabel" alignItems="center" flexShrink="0">
        {boolean && typeof rule.value === "boolean" ? itemLabel : label}
      </Text>
      {field ? (
        <>
          <ConditionSelect
            field={field}
            rule={rule}
            variant="filter-condition"
            onChange={onChange}
            open={boolean ? open : undefined}
            onOpenChange={boolean ? onOpenChange : undefined}
          />
          <RuleValueControl
            field={field}
            rule={rule}
            options={options}
            variant="filter-segment"
            open={open}
            onOpenChange={onOpenChange}
            onChange={(value) => onChange(selectRuleValues(field, rule, value))}
          />
        </>
      ) : (
        <Text textStyle="label/XS">Unavailable field</Text>
      )}
      <IconButton aria-label={`Remove ${label} filter`} variant="ghost" size="2xs" onClick={onRemove}>
        <Icon as={X} />
      </IconButton>
    </HStack>
  );
};
