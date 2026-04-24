import {
  Button,
  HStack,
  Icon,
  IconButton,
  Menu,
  Popover,
  Portal,
  SegmentGroup,
  Separator,
  Stack,
  Text,
} from "@chakra-ui/react";
import { ArrowDownUp, ChevronDown, KanbanSquare, List, Settings2 } from "lucide-react";
import { Fragment } from "react";

import type { DisplayProperty, GroupingField, OrderingField, WorkspaceOption, WorkspaceSettings } from "./types";
import { orderGroupingOptions, resolveSubGroupingOptions } from "./workspace-helpers";

interface DisplayMenuProps {
  settings: WorkspaceSettings;
  groupingOptions: WorkspaceOption<GroupingField>[];
  orderingOptions: WorkspaceOption<OrderingField>[];
  displayPropertyOptions: WorkspaceOption<DisplayProperty>[];
  onViewModeChange: (value: WorkspaceSettings["viewMode"]) => void;
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

const Dropdown = <T extends string>(props: {
  label: string;
  value: T;
  options: WorkspaceOption<T>[];
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

  return (
    <Popover.Root positioning={{ placement: "bottom-end", offset: { mainAxis: 8 } }}>
      <Popover.Trigger asChild>
        <IconButton aria-label="Display settings" variant="ghost" size="sm">
          <Icon as={Settings2} boxSize="14px" />
        </IconButton>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content width="320px" p="sm" bg="bg">
            <Stack gap="sm">
              <SectionLabel>View</SectionLabel>
              <SegmentGroup.Root
                size="sm"
                value={settings.viewMode}
                onValueChange={(event) => {
                  if (!event.value) return;
                  onViewModeChange(event.value as WorkspaceSettings["viewMode"]);
                }}
              >
                <SegmentGroup.Indicator />
                <SegmentGroup.Item value="list">
                  <SegmentGroup.ItemText>
                    <HStack as="span" gap="2xs">
                      <List size={14} />
                      <span>List</span>
                    </HStack>
                  </SegmentGroup.ItemText>
                  <SegmentGroup.ItemHiddenInput />
                </SegmentGroup.Item>
                <SegmentGroup.Item value="board">
                  <SegmentGroup.ItemText>
                    <HStack as="span" gap="2xs">
                      <KanbanSquare size={14} />
                      <span>Board</span>
                    </HStack>
                  </SegmentGroup.ItemText>
                  <SegmentGroup.ItemHiddenInput />
                </SegmentGroup.Item>
              </SegmentGroup.Root>

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
