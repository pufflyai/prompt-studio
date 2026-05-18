import { Button, HStack, Icon, IconButton, Menu, Popover, Portal, Separator, Stack, Text } from "@chakra-ui/react";
import { ArrowDownUp, ChevronDown, KanbanSquare, List, Settings2 } from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";
import { orderGroupingOptions, resolveSubGroupingOptions } from "./data-renderer-helpers";
import type { DataRendererOption, DataRendererSettings, DisplayProperty, GroupingField, OrderingField } from "./types";

interface DisplayMenuProps {
  settings: DataRendererSettings;
  groupingOptions: DataRendererOption<GroupingField>[];
  orderingOptions: DataRendererOption<OrderingField>[];
  displayPropertyOptions: DataRendererOption<DisplayProperty>[];
  onViewModeChange: (value: DataRendererSettings["viewMode"]) => void;
  onColumnGroupingChange: (value: GroupingField) => void;
  onRowGroupingChange: (value: GroupingField) => void;
  onOrderingFieldChange: (value: OrderingField) => void;
  onSortDirectionToggle: () => void;
  onDisplayPropertyToggle: (property: DisplayProperty) => void;
}

const SectionLabel = (props: { children: string }) => (
  <Text textStyle="label/XS/medium" color="fg.muted">
    {props.children}
  </Text>
);

const viewModeOptions = [
  { value: "list", label: "List", icon: List },
  { value: "board", label: "Board", icon: KanbanSquare },
] as const;

const Dropdown = <T extends string>(props: {
  label: string;
  value: T;
  options: DataRendererOption<T>[];
  onSelect: (value: T) => void;
}) => {
  const orderedOptions = orderGroupingOptions(props.options);
  const selectedLabel = orderedOptions.find((option) => option.value === props.value)?.label ?? props.label;
  const hasNoGrouping = orderedOptions[0]?.value === "none";

  return (
    <Stack gap="2xs">
      <SectionLabel>{props.label}</SectionLabel>
      <Menu.Root>
        <Menu.Trigger asChild>
          <Button size="sm" variant="outline" width="full" justifyContent="space-between">
            {selectedLabel}
            <Icon as={ChevronDown} color="fg.muted" />
          </Button>
        </Menu.Trigger>
        <Menu.Positioner>
          <Menu.Content minW="260px" bg="bg">
            {orderedOptions.map((option, index) => (
              <Fragment key={option.value}>
                {hasNoGrouping && index === 1 ? <Menu.Separator /> : null}
                <Menu.Item value={option.value} onClick={() => props.onSelect(option.value)}>
                  <Text textStyle="label/S/regular">{option.label}</Text>
                </Menu.Item>
              </Fragment>
            ))}
          </Menu.Content>
        </Menu.Positioner>
      </Menu.Root>
    </Stack>
  );
};

export const DisplayMenu = (props: DisplayMenuProps) => {
  const {
    settings,
    groupingOptions,
    orderingOptions,
    displayPropertyOptions,
    onViewModeChange,
    onColumnGroupingChange,
    onRowGroupingChange,
    onOrderingFieldChange,
    onSortDirectionToggle,
    onDisplayPropertyToggle,
  } = props;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

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
        <IconButton ref={triggerRef} aria-label="Display settings" variant="ghost" size="sm">
          <Icon as={Settings2} boxSize="14px" />
        </IconButton>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content ref={contentRef} width="320px" p="sm" bg="bg">
            <Stack gap="sm">
              <SectionLabel>View</SectionLabel>
              <HStack gap="2xs">
                {viewModeOptions.map((option) => {
                  const ViewModeIcon = option.icon;
                  const active = settings.viewMode === option.value;

                  return (
                    <Button
                      key={option.value}
                      flex="1"
                      size="sm"
                      variant={active ? "solid" : "outline"}
                      aria-pressed={active}
                      onClick={() => onViewModeChange(option.value)}
                    >
                      <ViewModeIcon size={14} />
                      {option.label}
                    </Button>
                  );
                })}
              </HStack>

              <Separator />

              <Dropdown
                label="Grouping"
                value={settings.columnGrouping}
                options={groupingOptions}
                onSelect={(value) => {
                  onColumnGroupingChange(value);
                  if (value === "none" || value === settings.rowGrouping) {
                    onRowGroupingChange("none");
                  }
                }}
              />

              <Dropdown
                label="Sub-grouping"
                value={settings.rowGrouping}
                options={resolveSubGroupingOptions(groupingOptions, settings.columnGrouping)}
                onSelect={onRowGroupingChange}
              />

              <Stack gap="2xs">
                <SectionLabel>Ordering</SectionLabel>
                <HStack gap="2xs">
                  <Dropdown
                    label="Sort by"
                    value={settings.ordering.field}
                    options={orderingOptions}
                    onSelect={onOrderingFieldChange}
                  />
                  <IconButton
                    mt="lg"
                    aria-label="Toggle sort direction"
                    size="sm"
                    variant="outline"
                    onClick={onSortDirectionToggle}
                    data-direction={settings.ordering.direction}
                  >
                    <Icon
                      as={ArrowDownUp}
                      transform={settings.ordering.direction === "asc" ? "rotate(0deg)" : "rotate(180deg)"}
                    />
                  </IconButton>
                </HStack>
              </Stack>

              <Separator />
              <Stack gap="2xs">
                <SectionLabel>Display properties</SectionLabel>
                <HStack flexWrap="wrap" gap="2xs">
                  {displayPropertyOptions.map((option) => {
                    const isActive = settings.displayProperties.includes(option.value);

                    return (
                      <Button
                        key={option.value}
                        size="2xs"
                        variant={isActive ? "solid" : "outline"}
                        onClick={() => onDisplayPropertyToggle(option.value)}
                      >
                        {option.label}
                      </Button>
                    );
                  })}
                </HStack>
              </Stack>
            </Stack>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
};
