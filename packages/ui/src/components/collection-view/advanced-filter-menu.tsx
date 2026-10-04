import { Box, Button, HStack, Stack, Text } from "@chakra-ui/react";
import type { ViewFilterGroup } from "@pstdio/sdk/extensions";
import { Plus } from "lucide-react";
import type { AttributeDescriptor } from "../kanban-renderer/types";
import { addRule, newRule, setConjunction, setRuleAt } from "./collection-view-rules";
import { FilterRuleRow } from "./filter-rule-row";
import type { RuleValueOption } from "./filter-rule-value";

export interface AdvancedFilterMenuProps {
  /** The filterable fields, in menu order. */
  fields: AttributeDescriptor[];
  filter: ViewFilterGroup;
  optionsFor: (field: AttributeDescriptor) => RuleValueOption[];
  onChange: (filter: ViewFilterGroup) => void;
}

/** All rules share one conjunction. */
export const AdvancedFilterMenu = (props: AdvancedFilterMenuProps) => {
  const { fields, filter, optionsFor, onChange } = props;
  const firstField = fields[0];

  return (
    <Stack data-testid="advanced-filter-menu" gap="2xs" minW="0">
      <Stack gap="2xs" paddingX="xs">
        {filter.rules.map((rule, index) => (
          <FilterRuleRow
            key={`${index}:${rule.attributeId}`}
            index={index}
            conjunction={filter.conjunction}
            onConjunctionChange={(conjunction) => onChange(setConjunction(filter, conjunction))}
            fields={fields}
            rule={rule}
            optionsFor={optionsFor}
            onChange={(next) => onChange(setRuleAt(filter, index, next))}
            onDelete={() => onChange(setRuleAt(filter, index, undefined))}
          />
        ))}
        {filter.rules.length === 0 ? (
          <Text textStyle="label/S/regular" color="fg.muted" paddingY="xs">
            No filter rules. Add one to narrow this view.
          </Text>
        ) : null}
      </Stack>
      <Box borderTopWidth="1px" borderColor="border.subtle" />
      <HStack gap="2xs" paddingX="2xs" paddingBottom="2xs">
        {firstField ? (
          <Button size="2xs" variant="ghost" onClick={() => onChange(addRule(filter, newRule(firstField)))}>
            <Plus />
            Add filter rule
          </Button>
        ) : null}
      </HStack>
    </Stack>
  );
};
