import { Box, HStack, Stack } from "@chakra-ui/react";

import { EmptyState } from "@/components/empty-state";

import { DisplayMenu } from "./display-menu";
import { FilterMenu } from "./filter-menu";
import {
  TicketBoard,
  type TicketBoardColumn,
  type TicketBoardColumnAction,
  type TicketBoardGroup,
} from "./ticket-board";
import { countFilterValues, filterTickets, groupTickets, orderTickets } from "./ticket-grouping";
import { TicketList, type TicketListItem } from "./ticket-list";
import {
  DEFAULT_DISPLAY_PROPERTY_OPTIONS,
  DEFAULT_GROUPING_OPTIONS,
  DEFAULT_ORDERING_OPTIONS,
  type DisplayProperty,
  type GroupingField,
  type OrderingField,
  type WorkspaceFilterCategory,
  type WorkspaceOption,
  type WorkspaceTagDefinition,
  type WorkspaceTicket,
} from "./types";
import { useTicketsWorkspaceStore } from "./use-workspace-store";
import { buildDefaultFilterCategories, buildTagOptions, toBadges, toTagBadges, toTitleCase } from "./workspace-helpers";

interface BoardColumnConfig {
  color?: string;
  canDragIn?: boolean;
  canDragOut?: boolean;
  canCreate?: boolean;
  actions?: TicketBoardColumnAction[];
}

interface TicketsWorkspaceProps<TTicket extends WorkspaceTicket = WorkspaceTicket> {
  tickets: TTicket[];
  storageKey: string;
  tagDefinitions?: WorkspaceTagDefinition[];
  selectedTicketId?: string | null;
  groupingOptions?: WorkspaceOption<GroupingField>[];
  orderingOptions?: WorkspaceOption<OrderingField>[];
  displayPropertyOptions?: WorkspaceOption<DisplayProperty>[];
  filterCategories?: WorkspaceFilterCategory[];
  knownColumnKeys?: string[];
  emptyTitle?: string;
  emptyDescription?: string;
  onTicketClick?: (ticket: TTicket) => void;
  onTagChange?: (ticketId: string, tagName: string, newValue: string) => void;
  onMoveTicket?: (ticketId: string, targetColumnId: string) => void;
  onMoveToGroup?: (ticketId: string, targetGroupKey: string) => void;
  onCreateTicket?: (columnId: string) => void;
  onColumnAction?: (columnId: string, actionId: string) => Promise<void> | void;
  getBoardColumnConfig?: (groupKey: string) => BoardColumnConfig;
}

export const TicketsWorkspace = <TTicket extends WorkspaceTicket>(props: TicketsWorkspaceProps<TTicket>) => {
  const {
    tickets,
    storageKey,
    tagDefinitions = [],
    selectedTicketId = null,
    groupingOptions: groupingOptionsProp,
    orderingOptions: orderingOptionsProp,
    displayPropertyOptions: displayPropertyOptionsProp,
    filterCategories,
    knownColumnKeys: knownColumnKeysProp,
    emptyTitle = "No tickets found",
    emptyDescription = "Try changing filters or display settings.",
    onTicketClick,
    onTagChange,
    onMoveTicket,
    onMoveToGroup,
    onCreateTicket,
    onColumnAction,
    getBoardColumnConfig,
  } = props;

  const tagOptions = buildTagOptions(tagDefinitions);

  const groupingOptions = groupingOptionsProp ?? [...DEFAULT_GROUPING_OPTIONS, ...tagOptions.grouping];
  const orderingOptions = orderingOptionsProp ?? [...DEFAULT_ORDERING_OPTIONS, ...tagOptions.ordering];
  const displayPropertyOptions = displayPropertyOptionsProp ?? [
    ...DEFAULT_DISPLAY_PROPERTY_OPTIONS,
    ...tagOptions.display,
  ];

  const settings = useTicketsWorkspaceStore(storageKey, (state) => state.settings);
  const filters = useTicketsWorkspaceStore(storageKey, (state) => state.filters);
  const setViewMode = useTicketsWorkspaceStore(storageKey, (state) => state.setViewMode);
  const setColumnGrouping = useTicketsWorkspaceStore(storageKey, (state) => state.setColumnGrouping);
  const setRowGrouping = useTicketsWorkspaceStore(storageKey, (state) => state.setRowGrouping);
  const setOrderingField = useTicketsWorkspaceStore(storageKey, (state) => state.setOrderingField);
  const toggleSortDirection = useTicketsWorkspaceStore(storageKey, (state) => state.toggleSortDirection);
  const toggleDisplayProperty = useTicketsWorkspaceStore(storageKey, (state) => state.toggleDisplayProperty);
  const toggleFilterValue = useTicketsWorkspaceStore(storageKey, (state) => state.toggleFilterValue);
  const clearFilter = useTicketsWorkspaceStore(storageKey, (state) => state.clearFilter);
  const clearAllFilters = useTicketsWorkspaceStore(storageKey, (state) => state.clearAllFilters);

  const visibleTickets = filterTickets(tickets, filters) as TTicket[];

  const categoryOptions = filterCategories ?? buildDefaultFilterCategories(tickets, tagDefinitions);

  const countsByCategory = Object.fromEntries(
    categoryOptions.map((category) => [category.id, countFilterValues(tickets, category.id)]),
  );

  const knownColumnKeys =
    knownColumnKeysProp ??
    (settings.columnGrouping !== "none"
      ? categoryOptions.find((c) => c.id === settings.columnGrouping)?.options.map((o) => o.value)
      : undefined);

  const grouped = groupTickets(visibleTickets, {
    columnGrouping: settings.columnGrouping,
    rowGrouping: settings.rowGrouping,
    knownColumnKeys,
  });

  const toListItem = (ticket: TTicket): TicketListItem => ({
    id: ticket.id,
    ticketId: settings.displayProperties.includes("id") ? ticket.ticketId : "",
    title: ticket.title,
    badges: toBadges(ticket, settings.displayProperties),
    tagBadges: toTagBadges(ticket, settings.displayProperties, tagDefinitions),
    onClick: () => onTicketClick?.(ticket),
    onTagChange: onTagChange ? (tagName, newValue) => onTagChange(ticket.id, tagName, newValue) : undefined,
  });

  const toGroupListItem = (group: { key: string; label: string; tickets: WorkspaceTicket[] }): TicketListItem => ({
    id: `group::${group.key}`,
    ticketId: "",
    title: `${toTitleCase(group.label)} (${group.tickets.length})`,
    children: orderTickets(group.tickets, settings.ordering, tagDefinitions).map((ticket) =>
      toListItem(ticket as TTicket),
    ),
  });

  const listItems: TicketListItem[] =
    settings.columnGrouping === "none"
      ? orderTickets(visibleTickets, settings.ordering, tagDefinitions).map((ticket) => toListItem(ticket as TTicket))
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
        badges: toBadges(ticket, settings.displayProperties),
        tagBadges: toTagBadges(ticket, settings.displayProperties, tagDefinitions),
        onClick: () => onTicketClick?.(ticket as TTicket),
        onTagChange: onTagChange
          ? (tagName: string, newValue: string) => onTagChange(ticket.id, tagName, newValue)
          : undefined,
      },
    }));

  const boardColumns: TicketBoardColumn[] = grouped.map((column) => {
    const columnConfig = getBoardColumnConfig?.(column.key) ?? {};
    const orderedTickets = orderTickets(column.tickets, settings.ordering, tagDefinitions);

    const groups: TicketBoardGroup[] | undefined =
      column.rows.length > 0
        ? column.rows.map((row) => ({
            key: row.key,
            label: toTitleCase(row.label),
            items: toBoardItems(orderTickets(row.tickets, settings.ordering, tagDefinitions)),
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
        <TicketList items={listItems} selectedItemId={selectedTicketId} />
      ) : (
        <EmptyState title={emptyTitle} description={emptyDescription} borderWidth="1px" borderRadius="md" />
      )}
    </Stack>
  );
};

export type { TicketsWorkspaceProps };
