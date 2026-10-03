import { Button, HStack, Icon, IconButton } from "@chakra-ui/react";
import type { ViewFilterGroup } from "@pstdio/sdk/extensions";
import { ListFilter, X } from "lucide-react";
import { useRef, useState } from "react";
import type { AttributeDescriptor } from "../kanban-renderer/types";
import { useCollectionItemLabel } from "./collection-item-label";
import { findField } from "./collection-view-fields";
import { pillConditionLabel, ruleValueLabel } from "./collection-view-labels";
import type { RuleValueOption } from "./filter-rule-value";
import { ViewBarPopover } from "./view-bar-popover";
import { ViewFilterMenu } from "./view-filter-menu";

interface AdvancedFilterPillProps {
  group: ViewFilterGroup;
  fields: AttributeDescriptor[];
  optionsFor: (field: AttributeDescriptor) => RuleValueOption[];
  onChange: (group: ViewFilterGroup) => void;
  onRemove: () => void;
}

export const AdvancedFilterPill = (props: AdvancedFilterPillProps) => {
  const { group, fields, optionsFor, onChange, onRemove } = props;
  const [open, setOpen] = useState(group.rules.length === 0);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const itemLabel = useCollectionItemLabel();
  const summary = group.rules
    .map((rule) => {
      const field = findField(fields, rule.attributeId);
      const subject =
        field?.type.kind === "boolean" && typeof rule.value === "boolean"
          ? itemLabel
          : (field?.label ?? rule.attributeId);
      return [subject, pillConditionLabel(rule, field), ruleValueLabel(rule, field)].filter(Boolean).join(" ");
    })
    .join(group.conjunction === "and" ? " and " : " or ");
  return (
    <HStack role="group" aria-label="Advanced filter" layerStyle="filterPill" gap="0" flexShrink={0}>
      <Button
        ref={anchorRef}
        aria-label="Edit advanced filter"
        variant="filter-segment"
        size="2xs"
        onClick={() => setOpen(!open)}
      >
        <Icon as={ListFilter} />
        {summary || "Advanced filter"}
      </Button>
      <IconButton aria-label="Remove advanced filter" variant="ghost" size="2xs" onClick={onRemove}>
        <Icon as={X} />
      </IconButton>
      <ViewBarPopover
        open={open}
        onOpenChange={setOpen}
        anchorRef={anchorRef}
        width="40rem"
        testId="advanced-filter-popover"
      >
        <ViewFilterMenu advanced fields={fields} filter={group} optionsFor={optionsFor} onChange={onChange} />
      </ViewBarPopover>
    </HStack>
  );
};
