import { Button, HStack, Icon, IconButton, Menu, Popover, Portal, Text } from "@chakra-ui/react";
import { Check, ChevronDown, List, Settings2, SortAsc, SortDesc, SquareKanban } from "lucide-react";
import { Fragment, type ReactNode, useEffect, useRef, useState } from "react";
import { Tooltip } from "@/components/primitives/tooltip";
import { type MenuOption, resolveSubGroupingOptions } from "./kanban-renderer-helpers";
import type { KanbanRendererSettings } from "./types";

interface DisplayMenuProps {
  settings: KanbanRendererSettings;
  groupingOptions: MenuOption[];
  orderingOptions: MenuOption[];
  displayPropertyOptions: MenuOption[];
  onViewModeChange: (value: KanbanRendererSettings["viewMode"]) => void;
  onColumnGroupingChange: (value: string) => void;
  onRowGroupingChange: (value: string) => void;
  onOrderingAttributeIdChange: (value: string) => void;
  onSortDirectionToggle: () => void;
  onDisplayPropertyToggle: (property: string) => void;
}

const SectionLabel = (props: { children: string }) => (
  <Text paddingX="xs" paddingTop="xs" paddingBottom="2xs" textStyle="label/XS/medium" color="fg.muted">
    {props.children}
  </Text>
);

const Dropdown = (props: {
  label: string;
  value: string;
  options: MenuOption[];
  onSelect: (value: string) => void;
  valueSuffix?: ReactNode;
  onSuffixAction?: () => void;
}) => {
  const selectedLabel = props.options.find((option) => option.value === props.value)?.label ?? props.label;
  const hasNoneFirst = props.options[0]?.value === "none";

  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <Button size="xs" variant="ghost" width="full" justifyContent="flex-start" gap="xs">
          <Text textStyle="label/S/regular">{props.label}</Text>
          <HStack marginLeft="auto" minW="0" gap="2xs" color="fg.muted">
            <Text textStyle="label/S/regular" truncate>
              {selectedLabel}
            </Text>
            {props.valueSuffix}
          </HStack>
          <ChevronDown size={12} />
        </Button>
      </Menu.Trigger>
      <Menu.Positioner>
        <Menu.Content>
          {props.options.map((option, index) => (
            <Fragment key={option.value}>
              {hasNoneFirst && index === 1 ? <Menu.Separator /> : null}
              <Menu.Item value={option.value} onClick={() => props.onSelect(option.value)}>
                <HStack width="full" gap="xs">
                  <Text textStyle="label/S/regular">{option.label}</Text>
                  {option.value === props.value ? <Icon as={Check} marginLeft="auto" boxSize="0.875rem" /> : null}
                </HStack>
              </Menu.Item>
            </Fragment>
          ))}
          {props.onSuffixAction ? (
            <>
              <Menu.Separator />
              <Menu.Item value="toggle-direction" onClick={props.onSuffixAction}>
                Reverse order
              </Menu.Item>
            </>
          ) : null}
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
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
    onOrderingAttributeIdChange,
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
      onOpenChange={(details) => setOpen(details.open)}
    >
      <Tooltip content="Display">
        <Popover.Trigger asChild>
          <IconButton ref={triggerRef} aria-label="Display settings" variant="ghost" size="2xs">
            <Icon as={Settings2} />
          </IconButton>
        </Popover.Trigger>
      </Tooltip>
      <Portal>
        <Popover.Positioner>
          <Popover.Content ref={contentRef} width="18.75rem" padding="xs" gap="1px">
            <SectionLabel>DISPLAY</SectionLabel>
            <HStack borderRadius="sm" bg="bg.subtle" padding="2xs" gap="2xs">
              <Button
                flex="1"
                size="2xs"
                variant="ghost"
                aria-pressed={settings.viewMode === "list"}
                onClick={() => onViewModeChange("list")}
              >
                <List />
                List
              </Button>
              <Button
                flex="1"
                size="2xs"
                variant="ghost"
                aria-pressed={settings.viewMode === "board"}
                onClick={() => onViewModeChange("board")}
              >
                <SquareKanban />
                Board
              </Button>
            </HStack>

            <Dropdown
              label="Grouping"
              value={settings.columnGrouping}
              options={groupingOptions}
              onSelect={(value) => {
                onColumnGroupingChange(value);
                if (value === "none" || value === settings.rowGrouping) onRowGroupingChange("none");
              }}
            />
            <Dropdown
              label="Ordering"
              value={settings.ordering.attributeId}
              options={orderingOptions}
              valueSuffix={
                settings.ordering.attributeId === "manual" ? undefined : (
                  <Icon
                    as={settings.ordering.direction === "asc" ? SortAsc : SortDesc}
                    aria-label={`${settings.ordering.direction === "asc" ? "Ascending" : "Descending"} order`}
                    aria-hidden={false}
                    role="img"
                    boxSize="0.875rem"
                    flexShrink={0}
                  />
                )
              }
              onSelect={onOrderingAttributeIdChange}
              onSuffixAction={settings.ordering.attributeId === "manual" ? undefined : onSortDirectionToggle}
            />
            <Dropdown
              label="Sub-grouping"
              value={settings.rowGrouping}
              options={resolveSubGroupingOptions(groupingOptions, settings.columnGrouping)}
              onSelect={onRowGroupingChange}
            />

            <SectionLabel>PROPERTIES</SectionLabel>
            <HStack paddingX="xs" paddingBottom="xs" flexWrap="wrap" gap="2xs">
              {displayPropertyOptions.map((option) => {
                const active = settings.displayProperties.includes(option.value);
                return (
                  <Button
                    key={option.value}
                    size="2xs"
                    variant="ghost"
                    aria-pressed={active}
                    onClick={() => onDisplayPropertyToggle(option.value)}
                  >
                    {option.label}
                  </Button>
                );
              })}
            </HStack>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
};
