import { Badge, Box, Button, HStack, Icon, IconButton, Popover, Portal, Stack, Text } from "@chakra-ui/react";
import { Check, Circle, CircleDot, Filter } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Header } from "../header";
import { ListRow } from "../list-row/list-row";
import { ScrollArea } from "../scroll-area";
import type { FilterCategoryView } from "./data-renderer-helpers";
import type { DataRendererFilterState } from "./types";

interface FilterMenuProps {
  categories: FilterCategoryView[];
  filters: DataRendererFilterState;
  countsByCategory: Record<string, Record<string, number>>;
  onReplaceFilterValue: (attributeId: string, value: string) => void;
  onToggleFilterValue: (attributeId: string, value: string) => void;
  onClearFilter: (attributeId: string) => void;
  onClearAll: () => void;
}

interface FilterOptionButtonProps {
  option: FilterCategoryView["options"][number];
  checked: boolean;
  count: number;
  isSingleSelect: boolean;
  onSelect: () => void;
}

const normalizeSelectedValues = (category: FilterCategoryView, selected: string[] | undefined) => {
  if (!selected || selected.length === 0) return [];
  if (category.selectionMode === "single") return selected.slice(0, 1);
  return selected;
};

const buildNormalizedFilters = (categories: FilterCategoryView[], filters: DataRendererFilterState) => {
  const normalized: DataRendererFilterState = {};
  for (const category of categories) {
    const values = normalizeSelectedValues(category, filters[category.id]);
    if (values.length > 0) normalized[category.id] = values;
  }
  return normalized;
};

const getActiveFilterCount = (filters: DataRendererFilterState) =>
  Object.values(filters).reduce((sum, values) => sum + (values?.length ?? 0), 0);

const getSelectedFilterDescription = (category: FilterCategoryView, selectedValues: string[]) => {
  if (selectedValues.length === 0) return undefined;

  const labels = selectedValues.map(
    (value) => category.options.find((option) => option.value === value)?.label ?? value,
  );

  if (labels.length <= 2) return labels.join(", ");

  return `${labels.slice(0, 2).join(", ")} +${labels.length - 2}`;
};

const FilterCategoryLabel = (props: { label: string; selectedDescription?: string }) => {
  const { label, selectedDescription } = props;

  return (
    <HStack gap="2xs" minW="0" width="full">
      <Text as="span" textStyle="label/S/regular" color="inherit" flexShrink={0} truncate>
        {label}
      </Text>
      {selectedDescription ? (
        <Text as="span" textStyle="label/XS" color="fg.menu-item.secondary" minW="0" truncate>
          {selectedDescription}
        </Text>
      ) : null}
    </HStack>
  );
};

const FilterOptionButton = (props: FilterOptionButtonProps) => {
  const { option, checked, count, isSingleSelect, onSelect } = props;

  return (
    <Button
      role={isSingleSelect ? "radio" : "checkbox"}
      aria-checked={checked}
      variant="ghost"
      size="sm"
      width="full"
      px="xs"
      py="2xs"
      height="auto"
      borderRadius="sm"
      justifyContent="flex-start"
      onClick={onSelect}
    >
      <Box
        boxSize="4"
        borderWidth="1px"
        borderRadius={isSingleSelect ? "full" : "xs"}
        borderColor={checked ? "fg" : "border"}
        bg={checked ? "fg" : "transparent"}
        color={checked ? "bg" : "transparent"}
        display="inline-flex"
        alignItems="center"
        justifyContent="center"
        flexShrink={0}
      >
        {isSingleSelect ? (
          <Icon as={checked ? CircleDot : Circle} boxSize="3" color={checked ? "bg" : "fg.muted"} />
        ) : checked ? (
          <Icon as={Check} boxSize="3" />
        ) : null}
      </Box>
      <HStack gap="2xs" justifyContent="space-between" flex="1" minW="0">
        <Text textStyle="label/S/regular">{option.label}</Text>
        <Text textStyle="label/XS/regular" color="fg.muted">
          {count}
        </Text>
      </HStack>
    </Button>
  );
};

export const FilterMenu = (props: FilterMenuProps) => {
  const {
    categories,
    filters,
    countsByCategory,
    onReplaceFilterValue,
    onToggleFilterValue,
    onClearFilter,
    onClearAll,
  } = props;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState<string>(categories[0]?.id ?? "");

  const activeCategory = categories.find((category) => category.id === activeCategoryId) ?? categories[0];

  const normalizedFilters = buildNormalizedFilters(categories, filters);
  const activeFilterCount = getActiveFilterCount(normalizedFilters);

  const handleOptionSelect = (category: FilterCategoryView, value: string) => {
    if (category.selectionMode === "single") {
      onReplaceFilterValue(category.id, value);
      setOpen(false);
      return;
    }

    onToggleFilterValue(category.id, value);
  };

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
          <Popover.Content
            ref={contentRef}
            width="min(440px, calc(100vw - 32px))"
            height="min(320px, calc(100vh - 32px))"
            p="0"
            bg="bg"
            gap="0"
            overflow="hidden"
          >
            <HStack align="stretch" gap="0" minH="0" height="full">
              <Stack minWidth="188px" borderRightWidth="1px" borderColor="border.muted" gap="0" minH="0">
                <Header
                  variant="narrow"
                  justifyContent="space-between"
                  borderBottomWidth="1px"
                  borderColor="border.muted"
                >
                  <Text textStyle="label/XS/medium" color="fg.muted">
                    Filters
                  </Text>
                  <Button size="2xs" variant="ghost" onClick={onClearAll}>
                    Clear all
                  </Button>
                </Header>
                <ScrollArea flex="1" minH="0" viewportProps={{ overscrollBehavior: "contain" }} p="0" gap="0">
                  {categories.map((category) => {
                    const selectedValues = normalizedFilters[category.id] ?? [];
                    const selectedDescription = getSelectedFilterDescription(category, selectedValues);

                    return (
                      <ListRow
                        key={category.id}
                        id={category.id}
                        label={<FilterCategoryLabel label={category.label} selectedDescription={selectedDescription} />}
                        role="button"
                        variant="compact"
                        isSelected={activeCategory?.id === category.id}
                        endContent={
                          selectedValues.length > 0 ? (
                            <Badge variant="subtle" bg="bg.muted" color="fg.muted">
                              {selectedValues.length}
                            </Badge>
                          ) : undefined
                        }
                        onActivate={() => setActiveCategoryId(category.id)}
                      />
                    );
                  })}
                </ScrollArea>
              </Stack>

              <Stack flex="1" gap="0" minW="0" minH="0">
                {activeCategory ? (
                  <>
                    <Header
                      variant="narrow"
                      justifyContent="space-between"
                      borderBottomWidth="1px"
                      borderColor="border.muted"
                    >
                      <Text textStyle="label/S/medium">{activeCategory.label}</Text>
                      <Button size="2xs" variant="ghost" onClick={() => onClearFilter(activeCategory.id)}>
                        Clear
                      </Button>
                    </Header>
                    <ScrollArea flex="1" minH="0" viewportProps={{ overscrollBehavior: "contain" }} p="0" gap="0">
                      {activeCategory.options.map((option) => {
                        const checked = (normalizedFilters[activeCategory.id] ?? []).includes(option.value);
                        const count = countsByCategory[activeCategory.id]?.[option.value] ?? 0;
                        const isSingleSelect = activeCategory.selectionMode === "single";

                        return (
                          <FilterOptionButton
                            key={option.value}
                            option={option}
                            checked={checked}
                            count={count}
                            isSingleSelect={isSingleSelect}
                            onSelect={() => handleOptionSelect(activeCategory, option.value)}
                          />
                        );
                      })}
                    </ScrollArea>
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
