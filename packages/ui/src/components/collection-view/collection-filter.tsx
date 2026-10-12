import { Button, HStack, Icon } from "@chakra-ui/react";
import type { ViewFilterGroup, ViewFilterRule } from "@pstdio/sdk/extensions";
import { ListFilter } from "lucide-react";
import { useRef, useState } from "react";
import { Tooltip } from "@/components/primitives/tooltip";
import type { AttributeDescriptor } from "../kanban-renderer/types";
import { addAdvancedGroup, normalFilter, setAdvancedGroup } from "./advanced-filter";
import { AdvancedFilterPill } from "./advanced-filter-pill";
import { CollectionItemLabelContext } from "./collection-item-label";
import { countFilterRules } from "./collection-view-filter";
import { FilterRulePill } from "./collection-view-pills";
import { addRule, setRuleAt } from "./collection-view-rules";
import { EMPTY_VIEW_FILTER } from "./collection-view-types";
import { FilterMenu } from "./filter-menu";
import type { RuleValueOption } from "./filter-rule-value";
import { ViewBarPopover } from "./view-bar-popover";

export interface CollectionFilterProps {
  itemLabel?: string;
  fields: AttributeDescriptor[];
  filter: ViewFilterGroup;
  optionsFor: (field: AttributeDescriptor) => RuleValueOption[];
  onFilterChange: (filter: ViewFilterGroup) => void;
}

/** The collection picker and editable criteria, without saved views or search. */
export function CollectionFilter(props: CollectionFilterProps) {
  const { itemLabel = "Item", fields, optionsFor, onFilterChange } = props;
  const filter = normalFilter(props.filter);
  const filterFields = fields.filter((field) => field.filterable);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [ruleIndex, setRuleIndex] = useState<number | null>(null);
  const selectRule = (rule: ViewFilterRule) => {
    const index = filter.rules.findIndex((entry) => entry.attributeId === rule.attributeId);
    if (Array.isArray(rule.value) && rule.value.length === 0) {
      onFilterChange(setRuleAt(filter, index, undefined));
      setRuleIndex(null);
      return;
    }
    const next = index === -1 ? addRule(filter, rule) : setRuleAt(filter, index, rule);
    onFilterChange(next);
    if (!Array.isArray(rule.value)) {
      setOpen(false);
      setRuleIndex(index === -1 ? next.rules.length - 1 : index);
    }
  };
  const count = countFilterRules(filter);
  return (
    <CollectionItemLabelContext.Provider value={itemLabel}>
      <HStack data-testid="collection-filter" minW="0" gap="2xs">
        <Tooltip content="Filter">
          <Button
            ref={anchorRef}
            aria-label="Filter"
            variant={count ? "subtle" : "ghost"}
            size="2xs"
            onClick={() => {
              setRuleIndex(null);
              setOpen(!open);
            }}
          >
            <Icon as={ListFilter} />
            {count || null}
          </Button>
        </Tooltip>
        <HStack minW="0" gap="2xs" overflowX="auto">
          {filter.rules.map((rule, index) => {
            const field = filterFields.find(({ id }) => id === rule.attributeId);
            return (
              <FilterRulePill
                key={`${index}:${rule.attributeId}`}
                fields={filterFields}
                rule={rule}
                options={field ? optionsFor(field) : []}
                open={ruleIndex === index}
                onOpenChange={(isOpen) => {
                  setRuleIndex(isOpen ? index : null);
                  if (isOpen) setOpen(false);
                }}
                onChange={(next) => onFilterChange(setRuleAt(filter, index, next))}
                onRemove={() => {
                  setRuleIndex(null);
                  onFilterChange(setRuleAt(filter, index, undefined));
                }}
              />
            );
          })}
          {filter.groups?.map((group, index) => (
            <AdvancedFilterPill
              key={index}
              fields={filterFields}
              group={group}
              optionsFor={optionsFor}
              onChange={(next) => onFilterChange(setAdvancedGroup(filter, index, next))}
              onRemove={() => onFilterChange(setAdvancedGroup(filter, index))}
            />
          ))}
        </HStack>
        <ViewBarPopover
          open={open}
          onOpenChange={setOpen}
          anchorRef={anchorRef}
          placement="bottom-start"
          width="min(440px, calc(100vw - 32px))"
          padding="0"
          testId="filter-menu-popover"
        >
          <FilterMenu
            fields={filterFields}
            filter={filter}
            optionsFor={optionsFor}
            onSelectRule={selectRule}
            onAddAdvanced={() => {
              setOpen(false);
              onFilterChange(addAdvancedGroup(filter));
            }}
            onClear={() => {
              setOpen(false);
              setRuleIndex(null);
              onFilterChange(EMPTY_VIEW_FILTER);
            }}
          />
        </ViewBarPopover>
      </HStack>
    </CollectionItemLabelContext.Provider>
  );
}
