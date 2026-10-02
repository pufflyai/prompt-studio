import { Box, Button, HStack, Stack, Text } from "@chakra-ui/react";
import type { ViewFilterGroup, ViewFilterRule } from "@pstdio/sdk/extensions";
import { ListPlus, Plus, Trash2 } from "lucide-react";
import type { AttributeDescriptor } from "../kanban-renderer/types";
import { isFilterGroup } from "./collection-view-filter";
import { addGroup, addRule, newRule, removeGroupAt, setConjunction, setRuleAt } from "./collection-view-rules";
import { EMPTY_VIEW_FILTER } from "./collection-view-types";
import { FilterRuleRow, RuleActionsMenu, RuleLead } from "./filter-rule-row";
import type { RuleValueOption } from "./filter-rule-value";

export interface ViewFilterMenuProps {
  /** The filterable fields, in menu order. */
  fields: AttributeDescriptor[];
  filter: ViewFilterGroup;
  optionsFor: (field: AttributeDescriptor) => RuleValueOption[];
  onChange: (filter: ViewFilterGroup) => void;
}

interface NestedGroupProps extends ViewFilterMenuProps {
  group: ViewFilterGroup;
  index: number;
}

const NestedGroup = (props: NestedGroupProps) => {
  const { fields, filter, group, index, optionsFor, onChange } = props;
  const firstField = fields[0];

  return (
    <HStack alignItems="flex-start" gap="xs" minW="0">
      <RuleLead
        index={index}
        conjunction={filter.conjunction}
        onConjunctionChange={(conjunction) => onChange(setConjunction(filter, conjunction))}
      />
      <Stack
        data-testid="filter-rule-group"
        flex="1"
        minW="0"
        gap="2xs"
        padding="xs"
        borderWidth="1px"
        borderColor="border.subtle"
        borderRadius="sm"
        bg="bg.subtle"
      >
        {group.rules.map((rule, nestedIndex) => (
          <FilterRuleRow
            key={`${nestedIndex}:${(rule as ViewFilterRule).attributeId}`}
            index={nestedIndex}
            conjunction={group.conjunction}
            onConjunctionChange={(conjunction) => onChange(setConjunction(filter, conjunction, index))}
            fields={fields}
            rule={rule as ViewFilterRule}
            optionsFor={optionsFor}
            onChange={(next) => onChange(setRuleAt(filter, [index, nestedIndex], next))}
            onDelete={() => onChange(setRuleAt(filter, [index, nestedIndex], undefined))}
          />
        ))}
        {firstField ? (
          <Button
            size="2xs"
            variant="ghost"
            alignSelf="flex-start"
            onClick={() => onChange(addRule(filter, newRule(firstField), index))}
          >
            <Plus />
            Add filter rule
          </Button>
        ) : null}
      </Stack>
      <RuleActionsMenu label="Group actions" onDelete={() => onChange(removeGroupAt(filter, index))} />
    </HStack>
  );
};

/** Advanced filter: one conjunction per group, and one level of nested groups. */
export const ViewFilterMenu = (props: ViewFilterMenuProps) => {
  const { fields, filter, optionsFor, onChange } = props;
  const firstField = fields[0];

  return (
    <Stack data-testid="view-filter-menu" gap="2xs" minW="0">
      <Text paddingX="xs" paddingTop="xs" textStyle="label/XS/medium" color="fg.muted">
        FILTER
      </Text>
      <Stack gap="2xs" paddingX="xs">
        {filter.rules.map((rule, index) =>
          isFilterGroup(rule) ? (
            <NestedGroup key={`group:${index}`} {...props} group={rule} index={index} />
          ) : (
            <FilterRuleRow
              key={`${index}:${rule.attributeId}`}
              index={index}
              conjunction={filter.conjunction}
              onConjunctionChange={(conjunction) => onChange(setConjunction(filter, conjunction))}
              fields={fields}
              rule={rule}
              optionsFor={optionsFor}
              onChange={(next) => onChange(setRuleAt(filter, [index], next))}
              onDelete={() => onChange(setRuleAt(filter, [index], undefined))}
            />
          ),
        )}
        {filter.rules.length === 0 ? (
          <Text textStyle="label/S/regular" color="fg.muted" paddingY="xs">
            No filter rules. Add one to narrow this view.
          </Text>
        ) : null}
      </Stack>
      <Box borderTopWidth="1px" borderColor="border.subtle" />
      <HStack gap="2xs" paddingX="2xs" paddingBottom="2xs">
        {firstField ? (
          <>
            <Button size="2xs" variant="ghost" onClick={() => onChange(addRule(filter, newRule(firstField)))}>
              <Plus />
              Add filter rule
            </Button>
            <Button size="2xs" variant="ghost" onClick={() => onChange(addGroup(filter, newRule(firstField)))}>
              <ListPlus />
              Add filter group
            </Button>
          </>
        ) : null}
        <Button
          size="2xs"
          variant="ghost"
          marginLeft="auto"
          disabled={filter.rules.length === 0}
          onClick={() => onChange(EMPTY_VIEW_FILTER)}
        >
          <Trash2 />
          Delete filter
        </Button>
      </HStack>
    </Stack>
  );
};
