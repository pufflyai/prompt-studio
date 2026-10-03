import { Badge, Box, Button, HStack, Icon, Input, Stack, Text } from "@chakra-ui/react";
import type { ViewFilterGroup, ViewFilterRule } from "@pstdio/sdk/extensions";
import { ChevronRight, ListFilter, Search } from "lucide-react";
import { useState } from "react";
import { ScrollArea } from "@/components/primitives/scroll-area";
import type { AttributeDescriptor } from "../kanban-renderer/types";
import { ListRow } from "../list-row/list-row";
import { fieldIcon } from "./collection-view-field-icon";
import { isOptionField } from "./collection-view-fields";
import { optionLabel } from "./collection-view-labels";
import { quickOptionValues } from "./collection-view-rules";
import { FilterPickerValues } from "./filter-picker-values";
import type { RuleValueOption } from "./filter-rule-value";

export interface FilterMenuProps {
  /** The filterable fields, in menu order. */
  fields: AttributeDescriptor[];
  filter: ViewFilterGroup;
  optionsFor: (field: AttributeDescriptor) => RuleValueOption[];
  onSelectRule: (rule: ViewFilterRule) => void;
  onAddAdvanced?: () => void;
}

const contentProps = { p: "2xs", display: "flex", flexDirection: "column", gap: "1px" } as const;

const selectedDescription = (field: AttributeDescriptor, values: string[]) => {
  const labels = values.map((value) => optionLabel(field, value));
  if (labels.length <= 2) return labels.join(", ");
  return `${labels.slice(0, 2).join(", ")} +${(labels.length - 2).toString()}`;
};

/** Browse a property, then commit a value and continue in its bubble. */
export const FilterMenu = (props: FilterMenuProps) => {
  const { fields, filter, optionsFor, onSelectRule } = props;
  const [query, setQuery] = useState("");
  const optionFields = fields.filter(isOptionField);
  const [activeId, setActiveId] = useState(optionFields[0]?.id ?? fields[0]?.id ?? "");
  const active = fields.find((field) => field.id === activeId) ?? fields[0];
  const needle = query.trim().toLocaleLowerCase();
  const visible = fields.filter((field) => field.label.toLocaleLowerCase().includes(needle));

  return (
    <Stack data-testid="filter-menu" height="min(320px, calc(100vh - 32px))" gap="0" overflow="hidden">
      <HStack height="2.25rem" gap="xs" paddingX="sm" borderBottomWidth="1px" borderColor="border.subtle">
        <Icon as={Search} boxSize="0.875rem" color="fg.muted" />
        <Input
          autoFocus
          aria-label="Filter properties"
          value={query}
          placeholder="Filter by…"
          variant="flushed"
          border="0"
          height="full"
          padding="0"
          onChange={(event) => setQuery(event.target.value)}
        />
      </HStack>
      <HStack alignItems="stretch" gap="0" flex="1" minH="0">
        <Stack
          data-testid="filter-property-column"
          width="11.75rem"
          flexShrink={0}
          borderRightWidth="1px"
          borderColor="border.subtle"
          gap="0"
          minH="0"
        >
          <ScrollArea flex="1" minH="0" viewportProps={{ overscrollBehavior: "contain" }} contentProps={contentProps}>
            {visible.map((field) => {
              const values = isOptionField(field) ? quickOptionValues(filter, field.id) : [];
              return (
                <ListRow
                  key={field.id}
                  id={field.id}
                  role="button"
                  variant="compact"
                  isSelected={active?.id === field.id}
                  icon={<Icon as={fieldIcon(field)} boxSize="3" />}
                  label={
                    <HStack minW="0" width="full" gap="2xs">
                      <Text textStyle="label/S/regular" truncate>
                        {field.label}
                      </Text>
                      {values.length > 0 ? (
                        <Text textStyle="label/XS" color="fg.menu-item.secondary" truncate>
                          {selectedDescription(field, values)}
                        </Text>
                      ) : null}
                    </HStack>
                  }
                  endContent={
                    values.length > 0 ? (
                      <Badge variant="number" colorPalette="gray">
                        {values.length}
                      </Badge>
                    ) : (
                      <Icon as={ChevronRight} boxSize="0.875rem" color="fg.subtle" />
                    )
                  }
                  onActivate={() => setActiveId(field.id)}
                />
              );
            })}
          </ScrollArea>
        </Stack>
        <Stack flex="1" minW="0" minH="0" gap="0">
          {active ? (
            <Box flex="1" minH="0" paddingX="2xs">
              <FilterPickerValues
                field={active}
                rule={filter.rules.find((rule) => rule.attributeId === active.id)}
                options={optionsFor(active)}
                onSelectRule={onSelectRule}
              />
            </Box>
          ) : null}
        </Stack>
      </HStack>
      {props.onAddAdvanced ? (
        <HStack data-testid="filter-menu-footer" padding="2xs" borderTopWidth="1px" borderColor="border.subtle">
          <Button size="2xs" variant="ghost" onClick={props.onAddAdvanced}>
            <ListFilter /> Advanced filter
          </Button>
        </HStack>
      ) : null}
    </Stack>
  );
};
