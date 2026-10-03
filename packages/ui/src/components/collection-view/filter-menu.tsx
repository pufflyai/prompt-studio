import { Badge, Box, Button, HStack, Icon, IconButton, Input, Stack, Text } from "@chakra-ui/react";
import type { ViewFilterGroup } from "@pstdio/sdk/extensions";
import { ChevronRight, ListFilter, Search, X } from "lucide-react";
import { useState } from "react";
import { ScrollArea } from "@/components/primitives/scroll-area";
import type { AttributeDescriptor } from "../kanban-renderer/types";
import { ListRow } from "../list-row/list-row";
import { fieldIcon } from "./collection-view-field-icon";
import { isOptionField } from "./collection-view-fields";
import { optionLabel } from "./collection-view-labels";
import { quickOptionValues, setQuickOptions } from "./collection-view-rules";
import { EMPTY_VIEW_FILTER } from "./collection-view-types";
import { RuleValueEditor, type RuleValueOption } from "./filter-rule-value";

export interface FilterMenuProps {
  /** The filterable fields, in menu order. */
  fields: AttributeDescriptor[];
  filter: ViewFilterGroup;
  optionsFor: (field: AttributeDescriptor) => RuleValueOption[];
  onChange: (filter: ViewFilterGroup) => void;
  /** A field without options gets a new rule and opens its editor. */
  onPickField: (field: AttributeDescriptor) => void;
  onAddAdvanced?: () => void;
}

const contentProps = { p: "2xs", display: "flex", flexDirection: "column", gap: "1px" } as const;

const selectedDescription = (field: AttributeDescriptor, values: string[]) => {
  const labels = values.map((value) => optionLabel(field, value));
  if (labels.length <= 2) return labels.join(", ");
  return `${labels.slice(0, 2).join(", ")} +${(labels.length - 2).toString()}`;
};

/** The quick property picker. Option fields get an "is any of" rule; other fields open the rule editor. */
export const FilterMenu = (props: FilterMenuProps) => {
  const { fields, filter, optionsFor, onChange, onPickField } = props;
  const [query, setQuery] = useState("");
  const optionFields = fields.filter(isOptionField);
  const [activeId, setActiveId] = useState(optionFields[0]?.id ?? "");
  const active = optionFields.find((field) => field.id === activeId) ?? optionFields[0];
  const needle = query.trim().toLocaleLowerCase();
  const visible = fields.filter((field) => field.label.toLocaleLowerCase().includes(needle));
  const activeValues = active ? quickOptionValues(filter, active.id) : [];

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
        <IconButton
          aria-label="Clear all filters"
          title="Clear all filters"
          size="2xs"
          variant="ghost"
          disabled={filter.rules.length === 0 && !filter.groups?.length}
          onClick={() => onChange(EMPTY_VIEW_FILTER)}
        >
          <X />
        </IconButton>
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
                  onActivate={() => (isOptionField(field) ? setActiveId(field.id) : onPickField(field))}
                />
              );
            })}
          </ScrollArea>
        </Stack>
        <Stack flex="1" minW="0" minH="0" gap="0">
          {active ? (
            <Box flex="1" minH="0" paddingX="2xs">
              <RuleValueEditor
                field={active}
                rule={{ attributeId: active.id, condition: "is-any-of", value: activeValues }}
                options={optionsFor(active)}
                onChange={(value) => onChange(setQuickOptions(filter, active, Array.isArray(value) ? value : []))}
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
