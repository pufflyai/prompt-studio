import { HStack, Icon, IconButton, Text } from "@chakra-ui/react";
import { normalizeBooleanViewRule, type ViewFilterRule } from "@pstdio/sdk/extensions";
import { X } from "lucide-react";
import type { AttributeDescriptor } from "../kanban-renderer/types";
import { useCollectionItemLabel } from "./collection-item-label";
import { fieldIcon } from "./collection-view-field-icon";
import { findField } from "./collection-view-fields";
import { newRule, selectRuleValues } from "./collection-view-rules";
import { RuleValueControl, type RuleValueOption } from "./filter-rule-value";
import { RuleSelect } from "./rule-select";
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
      <RuleSelect
        aria-label="Field"
        variant="filter-segment"
        showSelectedIcon={false}
        showSearch
        value={rule.attributeId}
        selectedLabel={boolean && typeof rule.value === "boolean" ? itemLabel : undefined}
        options={fields.map((entry) => ({ value: entry.id, label: entry.label, icon: fieldIcon(entry) }))}
        onSelect={(id) => {
          const next = findField(fields, id);
          if (next && next.id !== field?.id) {
            onChange(newRule(next));
            onOpenChange(true);
          }
        }}
      />
      {field ? (
        <>
          <ConditionSelect
            field={field}
            rule={rule}
            variant="filter-segment"
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
