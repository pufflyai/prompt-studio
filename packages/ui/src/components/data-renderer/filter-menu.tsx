import { Badge, Box, Button, HStack, Icon, IconButton, Popover, Portal, Stack, Text } from "@chakra-ui/react";
import { Check, Filter } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { FilterCategoryView } from "./data-renderer-helpers";
import type { DataRendererFilterState } from "./types";

interface FilterMenuProps {
  categories: FilterCategoryView[];
  filters: DataRendererFilterState;
  countsByCategory: Record<string, Record<string, number>>;
  onToggleFilterValue: (attributeId: string, value: string) => void;
  onClearFilter: (attributeId: string) => void;
  onClearAll: () => void;
}

const getActiveFilterCount = (filters: DataRendererFilterState) =>
  Object.values(filters).reduce((sum, values) => sum + (values?.length ?? 0), 0);

export const FilterMenu = (props: FilterMenuProps) => {
  const { categories, filters, countsByCategory, onToggleFilterValue, onClearFilter, onClearAll } = props;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState<string>(categories[0]?.id ?? "");

  const activeCategory = categories.find((category) => category.id === activeCategoryId) ?? categories[0];

  const activeFilterCount = getActiveFilterCount(filters);

  useEffect(() => {
    if (!open) return;

    const closeOnOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (contentRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsidePointerDown);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointerDown);
  }, [open]);

  return (
    <Popover.Root
      open={open}
      closeOnInteractOutside={false}
      positioning={{ placement: "bottom-end", offset: { mainAxis: 8 } }}
      onOpenChange={(event) => setOpen(event.open)}
    >
      <Popover.Trigger asChild>
        <IconButton ref={triggerRef} aria-label="Filter rows" variant="ghost" size="sm">
          <HStack gap="2xs">
            <Icon as={Filter} boxSize="14px" />
            {activeFilterCount > 0 ? <Badge variant="solid">{activeFilterCount}</Badge> : null}
          </HStack>
        </IconButton>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content ref={contentRef} width="560px" p="0" bg="bg" overflow="hidden">
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
                          <Button
                            key={option.value}
                            role="checkbox"
                            aria-checked={checked}
                            variant="ghost"
                            size="sm"
                            width="full"
                            px="xs"
                            py="2xs"
                            height="auto"
                            borderRadius="sm"
                            justifyContent="flex-start"
                            onClick={() => onToggleFilterValue(activeCategory.id, option.value)}
                          >
                            <Box
                              boxSize="4"
                              borderWidth="1px"
                              borderRadius="xs"
                              borderColor={checked ? "fg" : "border"}
                              bg={checked ? "fg" : "transparent"}
                              color={checked ? "bg" : "transparent"}
                              display="inline-flex"
                              alignItems="center"
                              justifyContent="center"
                              flexShrink={0}
                            >
                              {checked ? <Icon as={Check} boxSize="3" /> : null}
                            </Box>
                            <HStack gap="2xs" justifyContent="space-between" flex="1" minW="0">
                              <Text textStyle="label/S/regular">{option.label}</Text>
                              <Text textStyle="label/XS/regular" color="fg.muted">
                                {count}
                              </Text>
                            </HStack>
                          </Button>
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
