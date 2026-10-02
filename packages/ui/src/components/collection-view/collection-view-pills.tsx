import { Button, chakra, HStack, Icon, Popover, Portal, Text } from "@chakra-ui/react";
import type { ViewFilterGroup, ViewFilterRule, ViewSort } from "@pstdio/sdk/extensions";
import { ArrowDownWideNarrow, ArrowUpNarrowWide, ChevronDown, X } from "lucide-react";
import type { ComponentProps, ReactNode, Ref } from "react";
import type { AttributeDescriptor } from "../kanban-renderer/types";
import { findField } from "./collection-view-fields";
import { groupLabel, groupLead, pillConditionLabel, ruleValueLabel } from "./collection-view-labels";
import type { RuleValueOption } from "./filter-rule-value";
import { ViewFilterRuleEditor } from "./view-filter-rule-editor";

interface PillShellProps {
  children: ReactNode;
  removeLabel: string;
  onRemove: () => void;
}

/** Pills share the FilterPill shape: a hairline box with a remove button at the end. */
const PillShell = (props: PillShellProps) => {
  const { children, removeLabel, onRemove } = props;
  return (
    <HStack
      height="filter-pill"
      gap="2xs"
      paddingRight="2xs"
      borderWidth="1px"
      borderColor="border.subtle"
      borderRadius="xs"
      bg="bg.muted"
      flexShrink={0}
    >
      {children}
      <chakra.button
        type="button"
        aria-label={removeLabel}
        display="flex"
        alignItems="center"
        justifyContent="center"
        width="1rem"
        height="1rem"
        color="fg.muted"
        borderRadius="xs"
        _hover={{ color: "fg", bg: "bg.hover" }}
        onClick={onRemove}
      >
        <Icon as={X} boxSize="0.75rem" />
      </chakra.button>
    </HStack>
  );
};

const PillLabel = (props: ComponentProps<typeof chakra.button>) => (
  <chakra.button
    type="button"
    display="flex"
    alignItems="center"
    gap="2xs"
    height="full"
    paddingLeft="xs"
    minW="0"
    borderRadius="xs"
    {...props}
  />
);

export interface FilterRulePillProps {
  fields: AttributeDescriptor[];
  rule: ViewFilterRule;
  options: RuleValueOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (rule: ViewFilterRule) => void;
  onRemove: () => void;
  onOpenAdvanced: () => void;
}

/** Reads as a sentence, such as "Status is not Done", and opens the editor for its rule. */
export const FilterRulePill = (props: FilterRulePillProps) => {
  const { fields, rule, options, open, onOpenChange, onChange, onRemove, onOpenAdvanced } = props;
  const field = findField(fields, rule.attributeId);
  const label = field?.label ?? rule.attributeId;

  return (
    <Popover.Root
      open={open}
      lazyMount
      unmountOnExit
      positioning={{ placement: "bottom-start", offset: { mainAxis: 6 } }}
      onOpenChange={(details) => onOpenChange(details.open)}
    >
      <PillShell removeLabel={`Remove ${label} filter`} onRemove={onRemove}>
        <Popover.Trigger asChild>
          <PillLabel aria-label={`Edit ${label} filter`}>
            <Text textStyle="label/XS" color="fg.muted">
              {label} {pillConditionLabel(rule, field)}
            </Text>
            <Text textStyle="label/XS/medium" maxW="12rem" truncate>
              {ruleValueLabel(rule, field)}
            </Text>
          </PillLabel>
        </Popover.Trigger>
      </PillShell>
      <Portal>
        <Popover.Positioner>
          <Popover.Content width="18.75rem" padding="2xs">
            {field ? (
              <ViewFilterRuleEditor
                field={field}
                rule={rule}
                options={options}
                onChange={onChange}
                onDelete={onRemove}
                onOpenAdvanced={onOpenAdvanced}
              />
            ) : null}
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
};

export interface GroupPillProps {
  group: ViewFilterGroup;
  onOpen: () => void;
  onRemove: () => void;
}

/** A group reads as one pill, such as "Any of 2 rules", and opens the advanced filter. */
export const GroupPill = (props: GroupPillProps) => {
  const { group, onOpen, onRemove } = props;
  return (
    <PillShell removeLabel="Remove filter group" onRemove={onRemove}>
      <PillLabel aria-label={`Edit filter group: ${groupLabel(group)}`} onClick={onOpen}>
        <Text textStyle="label/XS" color="fg.muted">
          {groupLead(group)}
        </Text>
        <Text textStyle="label/XS/medium">
          {group.rules.length} {group.rules.length === 1 ? "rule" : "rules"}
        </Text>
      </PillLabel>
    </PillShell>
  );
};

export interface SortPillProps {
  fields: AttributeDescriptor[];
  sorts: ViewSort[];
  buttonRef: Ref<HTMLButtonElement>;
  onOpen: () => void;
}

/** The first sort plus "+n" for more levels. It has no remove button, so one click never reorders a board. */
export const SortPill = (props: SortPillProps) => {
  const { fields, sorts, buttonRef, onOpen } = props;
  const [first] = sorts;
  if (!first) return null;
  const label = findField(fields, first.attributeId)?.label ?? first.attributeId;
  return (
    <Button
      ref={buttonRef}
      aria-label={`Sorted by ${label}`}
      variant="subtle"
      size="2xs"
      flexShrink={0}
      onClick={onOpen}
    >
      <Icon as={first.direction === "asc" ? ArrowUpNarrowWide : ArrowDownWideNarrow} color="fg.muted" />
      <Text as="span" textStyle="label/XS/medium">
        {label}
      </Text>
      {sorts.length > 1 ? (
        <Text as="span" textStyle="label/XS" color="fg.subtle">
          +{sorts.length - 1}
        </Text>
      ) : null}
      <Icon as={ChevronDown} color="fg.subtle" />
    </Button>
  );
};
