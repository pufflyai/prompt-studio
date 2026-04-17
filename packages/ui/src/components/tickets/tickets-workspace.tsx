import { Box, HStack, Stack } from "@chakra-ui/react";
import { useEffect, useMemo } from "react";

import { EmptyState } from "@/components/empty-state";

import { DisplayMenu } from "./display-menu";
import { FilterMenu } from "./filter-menu";
import { type BadgeOptions, createTicketBadges } from "./ticket-badges";
import {
  TicketBoard,
  type TicketBoardColumn,
  type TicketBoardColumnAction,
  type TicketBoardGroup,
} from "./ticket-board";
import {
  countFilterValues,
  filterTickets,
  groupTickets,
  orderTickets,
  type TicketColumnGroup,
} from "./ticket-grouping";
import { TicketList, type TicketListItem } from "./ticket-list";
import {
  DEFAULT_DISPLAY_PROPERTY_OPTIONS,
  DEFAULT_GROUPING_OPTIONS,
  DEFAULT_ORDERING_OPTIONS,
  type DisplayProperty,
  type FilterCategory,
  type GroupingField,
  type OrderingField,
  type WorkspaceFilterCategory,
  type WorkspaceOption,
  type WorkspaceTicket,
} from "./types";
import { useTicketsWorkspaceStore } from "./use-workspace-store";

interface BoardColumnConfig {
  color?: string;
  canDragIn?: boolean;
  canDragOut?: boolean;
  canCreate?: boolean;
  actions?: TicketBoardColumnAction[];
}

interface ListDragPermissions {
  draggableItemIds: Set<string>;
  dropTargetGroupIds: Set<string>;
}

const getListDragState = (params: {
  columnGrouping: GroupingField;
  grouped: TicketColumnGroup[];
  onMoveTicket?: (ticketId: string, targetColumnId: string) => void;
  getBoardColumnConfig?: (groupKey: string) => BoardColumnConfig;
}) => {
  const { columnGrouping, grouped, onMoveTicket, getBoardColumnConfig } = params;

  const permissions: ListDragPermissions =
    columnGrouping === "none"
      ? { draggableItemIds: new Set<string>(), dropTargetGroupIds: new Set<string>() }
      : buildListDragPermissions(grouped, getBoardColumnConfig);

  const enabled =
    columnGrouping !== "none" &&
    !!onMoveTicket &&
    permissions.draggableItemIds.size > 0 &&
    permissions.dropTargetGroupIds.size > 0;

  return { permissions, enabled };
};

export const buildListDragPermissions = (
  grouped: TicketColumnGroup[],
  getBoardColumnConfig?: (groupKey: string) => BoardColumnConfig,
): ListDragPermissions => {
  const draggableItemIds = new Set<string>();
  const dropTargetGroupIds = new Set<string>();

  for (const column of grouped) {
    const config = getBoardColumnConfig?.(column.key) ?? {};

    if (config.canDragOut) {
      for (const ticket of column.tickets) {
        draggableItemIds.add(ticket.id);
      }
    }

    if (config.canDragIn) {
      dropTargetGroupIds.add(`group::${column.key}`);
    }
  }

  return { draggableItemIds, dropTargetGroupIds };
};

interface TicketsWorkspaceProps<TTicket extends WorkspaceTicket = WorkspaceTicket> {
  tickets: TTicket[];
  storageKey: string;
  selectedTicketId?: string | null;
  groupingOptions?: WorkspaceOption<GroupingField>[];
  orderingOptions?: WorkspaceOption<OrderingField>[];
  displayPropertyOptions?: WorkspaceOption<DisplayProperty>[];
  filterCategories?: WorkspaceFilterCategory[];
  knownColumnKeys?: string[];
  emptyTitle?: string;
  emptyDescription?: string;
  onTicketClick?: (ticket: TTicket) => void;
  onMoveTicket?: (ticketId: string, targetColumnId: string) => void;
  onMoveToGroup?: (ticketId: string, targetGroupKey: string) => void;
  onReorderTicket?: (ticketId: string, columnId: string, newIndex: number) => void;
  onCreateTicket?: (columnId: string) => void;
  onColumnAction?: (columnId: string, actionId: string) => Promise<void> | void;
  getBoardColumnConfig?: (groupKey: string) => BoardColumnConfig;
}

const toTitleCase = (value: string) =>
  value
    .replaceAll("_", " ")
    .split(" ")
    .filter((chunk) => chunk.length > 0)
    .map((chunk) => chunk[0]!.toUpperCase() + chunk.slice(1))
    .join(" ");

const filterValueGetters: Record<FilterCategory, (ticket: WorkspaceTicket) => string[]> = {
  status: (ticket) => (ticket.status ? [ticket.status] : []),
  assignee: (ticket) => (ticket.assignee ? [ticket.assignee] : []),
  labels: (ticket) => ticket.labels ?? [],
};

const collectCategoryOptions = (tickets: WorkspaceTicket[], category: FilterCategory) => {
  const values = new Set<string>();

  for (const ticket of tickets) {
    const ticketValues = filterValueGetters[category](ticket);
    for (const value of ticketValues) {
      values.add(value);
    }
  }

  return [...values]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((value) => ({ value, label: toTitleCase(value) }));
};

const buildDefaultFilterCategories = (tickets: WorkspaceTicket[]): WorkspaceFilterCategory[] => {
  return [
    { id: "status", label: "Status", options: collectCategoryOptions(tickets, "status") },
    { id: "labels", label: "Labels", options: collectCategoryOptions(tickets, "labels") },
  ];
};

const useWorkspaceSanitization = (params: {
  sanitize: (options: {
    allowedDisplayProperties: DisplayProperty[];
    allowedFilterCategories: FilterCategory[];
    allowedGroupingFields: GroupingField[];
    defaultColumnGrouping: GroupingField;
    defaultRowGrouping: GroupingField;
  }) => void;
  displayProperties: DisplayProperty[];
  filterCategories: FilterCategory[];
  groupingFields: GroupingField[];
}) => {
  const { sanitize, displayProperties, filterCategories, groupingFields } = params;

  const defaultColumnGrouping = groupingFields.find((field) => field !== "none") ?? groupingFields[0] ?? "none";
  const defaultRowGrouping = groupingFields.includes("none") ? "none" : (groupingFields[0] ?? "none");

  useEffect(() => {
    sanitize({
      allowedDisplayProperties: displayProperties,
      allowedFilterCategories: filterCategories,
      allowedGroupingFields: groupingFields,
      defaultColumnGrouping,
      defaultRowGrouping,
    });
  }, [sanitize, displayProperties, filterCategories, groupingFields, defaultColumnGrouping, defaultRowGrouping]);
};

const useWorkspaceOptionState = (params: {
  tickets: WorkspaceTicket[];
  filterCategories?: WorkspaceFilterCategory[];
  displayPropertyOptions: WorkspaceOption<DisplayProperty>[];
  groupingOptions: WorkspaceOption<GroupingField>[];
}) => {
  const { tickets, filterCategories, displayPropertyOptions, groupingOptions } = params;

  const categoryOptions = useMemo(
    () => filterCategories ?? buildDefaultFilterCategories(tickets),
    [filterCategories, tickets],
  );

  const enabledFilterCategoryIds = useMemo(() => categoryOptions.map((category) => category.id), [categoryOptions]);
  const enabledFilterCategoryIdSet = useMemo(() => new Set(enabledFilterCategoryIds), [enabledFilterCategoryIds]);
  const enabledDisplayProperties = useMemo(
    () => displayPropertyOptions.map((option) => option.value),
    [displayPropertyOptions],
  );
  const enabledGroupingFields = useMemo(() => groupingOptions.map((option) => option.value), [groupingOptions]);

  return {
    categoryOptions,
    enabledFilterCategoryIds,
    enabledFilterCategoryIdSet,
    enabledDisplayProperties,
    enabledGroupingFields,
  };
};

export const TicketsWorkspace = <TTicket extends WorkspaceTicket>(props: TicketsWorkspaceProps<TTicket>) => {
  const {
    tickets,
    storageKey,
    selectedTicketId = null,
    groupingOptions = DEFAULT_GROUPING_OPTIONS,
    orderingOptions = DEFAULT_ORDERING_OPTIONS,
    displayPropertyOptions = DEFAULT_DISPLAY_PROPERTY_OPTIONS,
    filterCategories,
    knownColumnKeys: knownColumnKeysProp,
    emptyTitle = "No tickets found",
    emptyDescription = "Try changing filters or display settings.",
    onTicketClick,
    onMoveTicket,
    onMoveToGroup,
    onReorderTicket,
    onCreateTicket,
    onColumnAction,
    getBoardColumnConfig,
  } = props;

  const settings = useTicketsWorkspaceStore(storageKey, (state) => state.settings);
  const filters = useTicketsWorkspaceStore(storageKey, (state) => state.filters);
  const setViewMode = useTicketsWorkspaceStore(storageKey, (state) => state.setViewMode);
  const setColumnGrouping = useTicketsWorkspaceStore(storageKey, (state) => state.setColumnGrouping);
  const setRowGrouping = useTicketsWorkspaceStore(storageKey, (state) => state.setRowGrouping);
  const setOrderingField = useTicketsWorkspaceStore(storageKey, (state) => state.setOrderingField);
  const toggleSortDirection = useTicketsWorkspaceStore(storageKey, (state) => state.toggleSortDirection);
  const toggleDisplayProperty = useTicketsWorkspaceStore(storageKey, (state) => state.toggleDisplayProperty);
  const sanitize = useTicketsWorkspaceStore(storageKey, (state) => state.sanitize);
  const toggleFilterValue = useTicketsWorkspaceStore(storageKey, (state) => state.toggleFilterValue);
  const clearFilter = useTicketsWorkspaceStore(storageKey, (state) => state.clearFilter);
  const clearAllFilters = useTicketsWorkspaceStore(storageKey, (state) => state.clearAllFilters);
  const visibleTickets = filterTickets(tickets, filters) as TTicket[];

  const {
    categoryOptions,
    enabledFilterCategoryIds,
    enabledFilterCategoryIdSet,
    enabledDisplayProperties,
    enabledGroupingFields,
  } = useWorkspaceOptionState({ tickets, filterCategories, displayPropertyOptions, groupingOptions });

  useWorkspaceSanitization({
    sanitize,
    displayProperties: enabledDisplayProperties,
    filterCategories: enabledFilterCategoryIds,
    groupingFields: enabledGroupingFields,
  });

  const countsByCategory = Object.fromEntries(
    categoryOptions.map((category) => [category.id, countFilterValues(tickets, category.id)]),
  );

  const knownColumnKeys =
    settings.columnGrouping === "none"
      ? undefined
      : (knownColumnKeysProp ??
        categoryOptions.find((c) => c.id === settings.columnGrouping)?.options.map((o) => o.value));

  const statusColorMap = (() => {
    if (!getBoardColumnConfig || settings.columnGrouping !== "status") return undefined;
    const keys = knownColumnKeys ?? categoryOptions.find((c) => c.id === "status")?.options.map((o) => o.value) ?? [];
    const map: Record<string, string> = {};
    for (const key of keys) {
      const color = getBoardColumnConfig(key).color;
      if (color) map[key] = color;
    }
    return Object.keys(map).length > 0 ? map : undefined;
  })();

  const handleLabelClick = (label: string) => toggleFilterValue("labels", label);
  const badgeOptions: BadgeOptions = {
    displayProperties: settings.displayProperties,
    statusColorMap,
    canFilterLabels: enabledFilterCategoryIdSet.has("labels"),
    onLabelClick: handleLabelClick,
  };

  const grouped = groupTickets(visibleTickets, {
    columnGrouping: settings.columnGrouping,
    rowGrouping: settings.rowGrouping,
    knownColumnKeys,
  });

  const listDragState = getListDragState({
    columnGrouping: settings.columnGrouping,
    grouped,
    onMoveTicket,
    getBoardColumnConfig,
  });

  const toListItem = (ticket: TTicket): TicketListItem => ({
    id: ticket.id,
    ticketId: settings.displayProperties.includes("id") ? ticket.ticketId : "",
    title: ticket.title,
    badges: createTicketBadges(ticket, badgeOptions),
    onClick: () => onTicketClick?.(ticket),
  });

  const toGroupListItem = (group: { key: string; label: string; tickets: WorkspaceTicket[] }): TicketListItem => ({
    id: `group::${group.key}`,
    ticketId: "",
    title: `${toTitleCase(group.label)} (${group.tickets.length})`,
    children: orderTickets(group.tickets, settings.ordering).map((ticket) => toListItem(ticket as TTicket)),
  });

  const listItems: TicketListItem[] =
    settings.columnGrouping === "none"
      ? orderTickets(visibleTickets, settings.ordering).map((ticket) => toListItem(ticket as TTicket))
      : grouped.map((group) => {
          if (group.rows.length > 0) {
            return {
              id: `group::${group.key}`,
              ticketId: "",
              title: `${toTitleCase(group.label)} (${group.tickets.length})`,
              children: group.rows.map((row) => ({
                ...toGroupListItem(row),
                id: `group::${group.key}::${row.key}`,
              })),
            };
          }
          return toGroupListItem(group);
        });

  const toBoardItems = (tickets: WorkspaceTicket[]) =>
    tickets.map((ticket) => ({
      id: ticket.id,
      cardProps: {
        ticketId: settings.displayProperties.includes("id") ? ticket.ticketId : "",
        parentPath: ticket.parentPath,
        title: ticket.title,
        badges: createTicketBadges(ticket, badgeOptions),
        onClick: () => onTicketClick?.(ticket as TTicket),
      },
    }));

  const boardColumns: TicketBoardColumn[] = grouped.map((column) => {
    const columnConfig = getBoardColumnConfig?.(column.key) ?? {};
    const orderedTickets = orderTickets(column.tickets, settings.ordering);

    const groups: TicketBoardGroup[] | undefined =
      column.rows.length > 0
        ? column.rows.map((row) => ({
            key: row.key,
            label: toTitleCase(row.label),
            items: toBoardItems(orderTickets(row.tickets, settings.ordering)),
          }))
        : undefined;

    return {
      id: column.key,
      label: column.label,
      color: columnConfig.color,
      canDragIn: columnConfig.canDragIn ?? false,
      canDragOut: columnConfig.canDragOut ?? false,
      canCreate: columnConfig.canCreate ?? false,
      actions: columnConfig.actions ?? [],
      items: toBoardItems(orderedTickets),
      groups,
    } satisfies TicketBoardColumn;
  });

  return (
    <Stack gap="sm" height="100%" minH="0">
      <HStack justifyContent="flex-end" gap="2xs">
        <FilterMenu
          categories={categoryOptions}
          filters={filters}
          countsByCategory={countsByCategory}
          onToggleFilterValue={toggleFilterValue}
          onClearFilter={clearFilter}
          onClearAll={clearAllFilters}
        />
        <DisplayMenu
          settings={settings}
          groupingOptions={groupingOptions}
          orderingOptions={orderingOptions}
          displayPropertyOptions={displayPropertyOptions}
          onViewModeChange={setViewMode}
          onColumnGroupingChange={setColumnGrouping}
          onRowGroupingChange={setRowGrouping}
          onOrderingFieldChange={setOrderingField}
          onSortDirectionToggle={toggleSortDirection}
          onDisplayPropertyToggle={toggleDisplayProperty}
        />
      </HStack>

      {settings.viewMode === "board" ? (
        <Box flex="1" minH="0">
          {boardColumns.length > 0 ? (
            <TicketBoard
              columns={boardColumns}
              selectedItemId={selectedTicketId}
              onMoveItem={onMoveTicket}
              onMoveToGroup={onMoveToGroup}
              onReorderItem={onReorderTicket}
              onCreateStart={onCreateTicket}
              onColumnAction={onColumnAction}
            />
          ) : (
            <EmptyState
              title={emptyTitle}
              description={emptyDescription}
              height="100%"
              borderWidth="1px"
              borderRadius="md"
            />
          )}
        </Box>
      ) : listItems.length > 0 ? (
        <TicketList
          items={listItems}
          selectedItemId={selectedTicketId}
          draggable={listDragState.enabled}
          draggableItemIds={listDragState.permissions.draggableItemIds}
          dropTargetGroupIds={listDragState.permissions.dropTargetGroupIds}
          onMoveItem={onMoveTicket}
        />
      ) : (
        <EmptyState title={emptyTitle} description={emptyDescription} borderWidth="1px" borderRadius="md" />
      )}
    </Stack>
  );
};

export type { TicketsWorkspaceProps };
