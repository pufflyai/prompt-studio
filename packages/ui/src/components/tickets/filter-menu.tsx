import { Badge, Box, Button, HStack, Icon, IconButton, Popover, Portal, Stack, Text } from "@chakra-ui/react";
import { Filter } from "lucide-react";
import { useState } from "react";

import { Checkbox } from "@/components/checkbox";

import type { FilterState, WorkspaceFilterCategory } from "./types";

interface FilterMenuProps {
  categories: WorkspaceFilterCategory[];
  filters: FilterState;
  countsByCategory: Record<string, Record<string, number>>;
  onToggleFilterValue: (category: WorkspaceFilterCategory["id"], value: string) => void;
  onClearFilter: (category: WorkspaceFilterCategory["id"]) => void;
  onClearAll: () => void;
}

const getActiveFilterCount = (filters: FilterState) =>
  Object.values(filters).reduce((sum, values) => sum + (values?.length ?? 0), 0);

export const FilterMenu = (props: FilterMenuProps) => {
  const { categories, filters, countsByCategory, onToggleFilterValue, onClearFilter, onClearAll } = props;
  const [activeCategoryId, setActiveCategoryId] = useState<WorkspaceFilterCategory["id"]>(
    categories[0]?.id ?? "status",
  );

  const activeCategory = categories.find((category) => category.id === activeCategoryId) ?? categories[0];

  const activeFilterCount = getActiveFilterCount(filters);

  return (
    <Popover.Root positioning={{ placement: "bottom-end", offset: { mainAxis: 8 } }}>
      <Popover.Trigger asChild>
        <IconButton aria-label="Filter tickets" variant={activeFilterCount > 0 ? "outline" : "ghost"} size="sm">
          <HStack gap="2xs">
            <Icon as={Filter} boxSize="14px" />
            {activeFilterCount > 0 ? <Badge variant="solid">{activeFilterCount}</Badge> : null}
          </HStack>
        </IconButton>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content width="560px" p="0" bg="bg" overflow="hidden">
            <HStack align="stretch" gap="0" minH="320px">
              <Stack width="220px" borderRightWidth="1px" borderColor="border.muted" p="sm" gap="2xs">
                <HStack justifyContent="space-between">
                  <Text textStyle="label/XS/medium" color="fg.muted">
                    Filters
                  </Text>
                  <Button size="2xs" variant="ghost" onClick={onClearAll}>
                    Clear all
                  </Button>
                </HStack>
                {categories.map((category) => {
                  const selectedValues = filters[category.id] ?? [];
                  return (
                    <Button
                      key={category.id}
                      variant={activeCategoryId === category.id ? "subtle" : "ghost"}
                      size="sm"
                      justifyContent="space-between"
                      onClick={() => setActiveCategoryId(category.id)}
                    >
                      <Text>{category.label}</Text>
                      {selectedValues.length > 0 ? <Badge variant="subtle">{selectedValues.length}</Badge> : null}
                    </Button>
                  );
                })}
              </Stack>

              <Stack flex="1" p="sm" gap="sm">
                {activeCategory ? (
                  <>
                    <HStack justifyContent="space-between">
                      <Text textStyle="label/S/medium">{activeCategory.label}</Text>
                      <Button size="2xs" variant="ghost" onClick={() => onClearFilter(activeCategory.id)}>
                        Clear
                      </Button>
                    </HStack>
                    <Stack gap="2xs">
                      {activeCategory.options.map((option) => {
                        const checked = (filters[activeCategory.id] ?? []).includes(option.value);
                        const count = countsByCategory[activeCategory.id]?.[option.value] ?? 0;

                        return (
                          <Box key={option.value} px="xs" py="2xs" borderRadius="sm" _hover={{ bg: "bg.subtle" }}>
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() => onToggleFilterValue(activeCategory.id, option.value)}
                            >
                              <HStack gap="2xs" justifyContent="space-between" width="full">
                                <Text textStyle="label/S/regular">{option.label}</Text>
                                <Text textStyle="label/XS/regular" color="fg.muted">
                                  {count}
                                </Text>
                              </HStack>
                            </Checkbox>
                          </Box>
                        );
                      })}
                    </Stack>
                  </>
                ) : null}
              </Stack>
            </HStack>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
};
