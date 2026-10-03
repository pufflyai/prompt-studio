import { HStack, Icon, IconButton, Menu, Text } from "@chakra-ui/react";
import { normalizeBooleanViewRule, type ViewFilterGroup, type ViewFilterRule } from "@pstdio/sdk/extensions";
import { MoreHorizontal, Trash2 } from "lucide-react";
import type { AttributeDescriptor } from "../kanban-renderer/types";
import { useCollectionItemLabel } from "./collection-item-label";
import { findField } from "./collection-view-fields";
import { newRule } from "./collection-view-rules";
import { RuleValueControl, type RuleValueOption } from "./filter-rule-value";
import { RuleSelect } from "./rule-select";
import { ConditionSelect } from "./view-filter-rule-editor";

type Conjunction = ViewFilterGroup["conjunction"];

interface RuleLeadProps {
  index: number;
  conjunction: Conjunction;
  onConjunctionChange: (conjunction: Conjunction) => void;
}

/** A group has one conjunction, so only its second rule offers a choice and later rules repeat it. */
export const RuleLead = (props: RuleLeadProps) => {
  const { index, conjunction, onConjunctionChange } = props;
  const label = conjunction === "and" ? "And" : "Or";
  if (index === 1)
    return (
      <RuleSelect
        aria-label="Conjunction"
        width="3.75rem"
        options={[
          { value: "and", label: "And" },
          { value: "or", label: "Or" },
        ]}
        value={conjunction}
        onSelect={(value) => onConjunctionChange(value as Conjunction)}
      />
    );
  return (
    <Text width="3.75rem" flexShrink={0} paddingX="xs" textStyle="label/S/regular" color="fg.muted">
      {index === 0 ? "Where" : label}
    </Text>
  );
};

export interface RuleActionsMenuProps {
  label: string;
  onDelete: () => void;
}

export const RuleActionsMenu = (props: RuleActionsMenuProps) => {
  const { label, onDelete } = props;
  return (
    <Menu.Root positioning={{ placement: "bottom-end" }}>
      <Menu.Trigger asChild>
        <IconButton aria-label={label} variant="ghost" size="2xs" flexShrink={0}>
          <Icon as={MoreHorizontal} />
        </IconButton>
      </Menu.Trigger>
      <Menu.Positioner>
        <Menu.Content>
          <Menu.Item value="delete" onClick={onDelete}>
            <Icon as={Trash2} boxSize="0.875rem" />
            Delete
          </Menu.Item>
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
  );
};

export interface FilterRuleRowProps extends RuleLeadProps {
  fields: AttributeDescriptor[];
  rule: ViewFilterRule;
  optionsFor: (field: AttributeDescriptor) => RuleValueOption[];
  onChange: (rule: ViewFilterRule) => void;
  onDelete: () => void;
}

export const FilterRuleRow = (props: FilterRuleRowProps) => {
  const { fields, rule: savedRule, optionsFor, onChange, onDelete } = props;
  const field = findField(fields, savedRule.attributeId);
  const rule = field ? normalizeBooleanViewRule(savedRule, field.type) : savedRule;
  const itemLabel = useCollectionItemLabel();

  return (
    <HStack data-testid="filter-rule-row" gap="xs" minH="1.75rem" minW="0">
      <RuleLead {...props} />
      <RuleSelect
        aria-label="Field"
        width="8.75rem"
        showSearch
        options={fields.map((entry) => ({ value: entry.id, label: entry.label }))}
        selectedLabel={field?.type.kind === "boolean" && typeof rule.value === "boolean" ? itemLabel : undefined}
        value={rule.attributeId}
        onSelect={(id) => {
          const next = findField(fields, id);
          if (next && id !== rule.attributeId) onChange(newRule(next));
        }}
      />
      {field ? (
        <>
          <ConditionSelect field={field} rule={rule} width="7.5rem" onChange={onChange} />
          <RuleValueControl
            field={field}
            rule={rule}
            options={optionsFor(field)}
            onChange={(value) => onChange({ ...rule, value })}
          />
        </>
      ) : (
        <Text textStyle="label/S/regular" color="fg.muted">
          This field is no longer available
        </Text>
      )}
      <HStack flex="1" />
      <RuleActionsMenu label="Rule actions" onDelete={onDelete} />
    </HStack>
  );
};
