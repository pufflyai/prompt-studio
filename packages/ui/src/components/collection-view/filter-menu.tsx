import { Badge, Box, Button, HStack, Icon, Input, Stack, Text } from "@chakra-ui/react";
import type { ViewFilterGroup } from "@pstdio/sdk/extensions";
import { ChevronRight, ListFilter, Search } from "lucide-react";
import { useState } from "react";
import { ScrollArea } from "@/components/primitives/scroll-area";
import type { AttributeDescriptor } from "../kanban-renderer/types";
import { ListRow } from "../list-row/list-row";
import { isOptionField } from "./collection-view-fields";
import { optionLabel } from "./collection-view-labels";
import { clearQuickOptions, quickOptionValues, setQuickOptions } from "./collection-view-rules";
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
  onOpenAdvanced: () => void;
}

const contentProps = { p: "2xs", display: "flex", flexDirection: "column", gap: "1px" } as const;

const selectedDescription = (field: AttributeDescriptor, values: string[]) => {
  const labels = values.map((value) => optionLabel(field, value));
  if (labels.length <= 2) return labels.join(", ");
  return `${labels.slice(0, 2).join(", ")} +${(labels.length - 2).toString()}`;
};

/** The quick property picker. Option fields get an "is any of" rule; other fields open the rule editor. */
export const FilterMenu = (props: FilterMenuProps) => {
  const { fields, filter, optionsFor, onChange, onPickField, onOpenAdvanced } = props;
  const [query, setQuery] = useState("");
  const optionFields = fields.filter(isOptionField);
  const [activeId, setActiveId] = useState(optionFields[0]?.id ?? "");
  const active = optionFields.find((field) => field.id === activeId) ?? optionFields[0];
  const needle = query.trim().toLocaleLowerCase();
  const visible = fields.filter((field) => field.label.toLocaleLowerCase().includes(needle));
  const activeValues = active ? quickOptionValues(filter, active.id) : [];

  return (
    <Stack data-testid="filter-menu" height="min(320px, calc(100vh - 32px))" gap="0" margin="-2xs" overflow="hidden">
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
          <HStack height="2rem" paddingX="sm">
            <Text textStyle="label/XS/medium" color="fg.muted">
              PROPERTY
            </Text>
            <Button marginLeft="auto" size="2xs" variant="ghost" onClick={() => onChange(EMPTY_VIEW_FILTER)}>
              Clear all
            </Button>
          </HStack>
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
            <>
              <HStack height="2rem" paddingX="sm">
                <Text textStyle="label/XS/medium" color="fg.muted" truncate>
                  {active.label.toUpperCase()}
                </Text>
                <Button
                  marginLeft="auto"
                  size="2xs"
                  variant="ghost"
                  onClick={() => onChange(clearQuickOptions(filter, active.id))}
                >
                  Clear
                </Button>
              </HStack>
              <Box flex="1" minH="0" paddingX="2xs">
                <RuleValueEditor
                  field={active}
                  rule={{ attributeId: active.id, condition: "is-any-of", value: activeValues }}
                  options={optionsFor(active)}
                  onChange={(value) => onChange(setQuickOptions(filter, active, Array.isArray(value) ? value : []))}
                />
              </Box>
            </>
          ) : null}
        </Stack>
      </HStack>
      <HStack borderTopWidth="1px" borderColor="border.subtle" paddingX="2xs" paddingY="2xs">
        <Button size="2xs" variant="ghost" onClick={onOpenAdvanced}>
          <ListFilter />
          Advanced filter
        </Button>
      </HStack>
    </Stack>
  );
};
