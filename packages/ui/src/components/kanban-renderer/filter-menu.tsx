import { Badge, Button, HStack, Icon, IconButton, Input, Popover, Portal, Stack, Text } from "@chakra-ui/react";
import { Filter, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Checkbox } from "@/components/primitives/checkbox";
import { ScrollArea } from "@/components/primitives/scroll-area";
import { Tooltip } from "@/components/primitives/tooltip";
import { ListRow } from "../list-row/list-row";
import type { FilterCategoryView } from "./kanban-renderer-helpers";
import type { KanbanRendererFilterState } from "./types";

interface FilterMenuProps {
  categories: FilterCategoryView[];
  filters: KanbanRendererFilterState;
  countsByCategory: Record<string, Record<string, number>>;
  onToggleFilterValue: (attributeId: string, value: string) => void;
  onClearFilter: (attributeId: string) => void;
  onClearAll: () => void;
}

const contentProps = {
  p: "2xs",
  display: "flex",
  flexDirection: "column",
  gap: "1px",
} as const;

const selectedValues = (filters: KanbanRendererFilterState, categoryId: string) =>
  filters[categoryId]?.filter(Boolean) ?? [];

const hasActiveFilters = (filters: KanbanRendererFilterState) =>
  Object.values(filters).some((values) => values.length > 0);

const selectedDescription = (category: FilterCategoryView, values: string[]) => {
  const labels = values.map((value) => category.options.find((option) => option.value === value)?.label ?? value);
  if (labels.length <= 2) return labels.join(", ");
  return `${labels.slice(0, 2).join(", ")} +${(labels.length - 2).toString()}`;
};

const CategoryLabel = (props: { category: FilterCategoryView; values: string[] }) => {
  const { category, values } = props;

  return (
    <HStack minW="0" width="full" gap="2xs">
      <Text textStyle="label/S/regular" truncate>
        {category.label}
      </Text>
      {values.length > 0 ? (
        <Text textStyle="label/XS" color="fg.menu-item.secondary" truncate>
          {selectedDescription(category, values)}
        </Text>
      ) : null}
    </HStack>
  );
};

const OptionLabel = (props: { checked: boolean; label: string }) => (
  <HStack minW="0" gap="xs">
    <Checkbox
      checked={props.checked}
      readOnly
      aria-readonly="true"
      inputProps={{ tabIndex: -1, "aria-hidden": true }}
      pointerEvents="none"
      size="sm"
    />
    <Text textStyle="label/S/regular" truncate>
      {props.label}
    </Text>
  </HStack>
);

export const FilterMenu = (props: FilterMenuProps) => {
  const { categories, filters, countsByCategory, onToggleFilterValue, onClearFilter, onClearAll } = props;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeCategoryId, setActiveCategoryId] = useState(categories[0]?.id ?? "");
  const activeCategory = categories.find((category) => category.id === activeCategoryId) ?? categories[0];
  const filtersApplied = hasActiveFilters(filters);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleCategories = categories.filter((category) =>
    category.label.toLocaleLowerCase().includes(normalizedQuery),
  );

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (contentRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointerDown);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointerDown);
  }, [open]);

  return (
    <Popover.Root
      open={open}
      closeOnInteractOutside={false}
      positioning={{
        placement: "bottom-end",
        offset: { mainAxis: 8 },
        getAnchorElement: () => triggerRef.current,
      }}
      onOpenChange={(details) => {
        setOpen(details.open);
        if (!details.open) setQuery("");
      }}
    >
      <Tooltip content="Filter">
        <Popover.Trigger asChild>
          <IconButton
            ref={triggerRef}
            aria-label="Filter rows"
            aria-pressed={filtersApplied}
            variant={filtersApplied ? "subtle" : "ghost"}
            size="2xs"
          >
            <Icon as={Filter} />
          </IconButton>
        </Popover.Trigger>
      </Tooltip>
      <Portal>
        <Popover.Positioner>
          <Popover.Content
            ref={contentRef}
            width="min(440px, calc(100vw - 32px))"
            height="min(320px, calc(100vh - 32px))"
            padding="0"
            gap="0"
            overflow="hidden"
          >
            <HStack height="2.25rem" gap="xs" paddingX="sm" borderBottomWidth="1px" borderColor="border.subtle">
              <Icon as={Search} boxSize="0.875rem" color="fg.muted" />
              <Input
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
                  <Button marginLeft="auto" size="2xs" variant="ghost" onClick={onClearAll}>
                    Clear all
                  </Button>
                </HStack>
                <ScrollArea
                  flex="1"
                  minH="0"
                  viewportProps={{ overscrollBehavior: "contain" }}
                  contentProps={contentProps}
                >
                  {visibleCategories.map((category) => {
                    const values = selectedValues(filters, category.id);
                    return (
                      <ListRow
                        key={category.id}
                        id={category.id}
                        role="button"
                        variant="compact"
                        isSelected={activeCategory?.id === category.id}
                        label={<CategoryLabel category={category} values={values} />}
                        endContent={
                          values.length > 0 ? (
                            <Badge variant="number" colorPalette="gray">
                              {values.length}
                            </Badge>
                          ) : undefined
                        }
                        onActivate={() => setActiveCategoryId(category.id)}
                      />
                    );
                  })}
                </ScrollArea>
              </Stack>
              <Stack flex="1" minW="0" minH="0" gap="0">
                {activeCategory ? (
                  <>
                    <HStack height="2rem" paddingX="sm">
                      <Text textStyle="label/S/medium" truncate>
                        {activeCategory.label}
                      </Text>
                      <Button
                        marginLeft="auto"
                        size="2xs"
                        variant="ghost"
                        onClick={() => onClearFilter(activeCategory.id)}
                      >
                        Clear
                      </Button>
                    </HStack>
                    <ScrollArea
                      flex="1"
                      minH="0"
                      viewportProps={{ overscrollBehavior: "contain" }}
                      contentProps={contentProps}
                    >
                      {activeCategory.options.map((option) => {
                        const checked = selectedValues(filters, activeCategory.id).includes(option.value);
                        return (
                          <ListRow
                            key={option.value}
                            id={option.value}
                            role="checkbox"
                            aria-label={option.label}
                            aria-checked={checked}
                            variant="compact"
                            label={<OptionLabel checked={checked} label={option.label} />}
                            endContent={
                              <Text textStyle="label/XS" color="fg.muted">
                                {countsByCategory[activeCategory.id]?.[option.value] ?? 0}
                              </Text>
                            }
                            onActivate={() => onToggleFilterValue(activeCategory.id, option.value)}
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
