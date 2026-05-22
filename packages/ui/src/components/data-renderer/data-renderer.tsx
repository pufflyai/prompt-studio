import { Box, Stack } from "@chakra-ui/react";
import type { ReactNode } from "react";

import { EmptyState } from "@/components/empty-state";
import {
  DataRendererBoard,
  type DataRendererBoardColumn,
  type DataRendererBoardColumnAction,
  type DataRendererBoardGroup,
} from "./data-renderer-board";
import { type DataRendererColumnGroup, filterRows, groupRows, orderRows } from "./data-renderer-grouping";
import {
  buildDefaultFilterCategories,
  resolveKnownColumnKeys,
  resolveListDropTargetColumnKey,
  toBadges,
  toTagBadges,
  toTitleCase,
} from "./data-renderer-helpers";
import { DataRendererList, type DataRendererListItem } from "./data-renderer-list";
import { DataRendererToolbar } from "./data-renderer-toolbar";
import type {
  DataRendererFilterCategory,
  DataRendererFilterState,
  DataRendererOption,
  DataRendererRow,
  DataRendererSettings,
  DataRendererTagDefinition,
  DisplayProperty,
  GroupingField,
  OrderingField,
} from "./types";
import { useDataRendererStore } from "./use-data-renderer-store";

export interface BoardColumnConfig {
  color?: string;
  canDragIn?: boolean;
  canDragOut?: boolean;
  canCreate?: boolean;
  actions?: DataRendererBoardColumnAction[];
}

interface DataRendererProps<TTicket extends DataRendererRow = DataRendererRow> {
  tickets: TTicket[];
  storageKey: string;
  tagDefinitions?: DataRendererTagDefinition[];
  selectedTicketId?: string | null;
  groupingOptions?: DataRendererOption<GroupingField>[];
  orderingOptions?: DataRendererOption<OrderingField>[];
  displayPropertyOptions?: DataRendererOption<DisplayProperty>[];
  filterCategories?: DataRendererFilterCategory[];
  knownColumnKeys?: string[];
  emptyTitle?: string;
  emptyDescription?: string;
  defaultSettings?: Partial<DataRendererSettings>;
  defaultFilters?: DataRendererFilterState;
  hideToolbar?: boolean;
  toolbarLeading?: ReactNode;
  onTicketClick?: (ticket: TTicket) => void;
  onTagChange?: (ticketId: string, tagName: string, newValue: string) => void;
  onMoveTicket?: (
    ticketId: string,
    targetColumnId: string,
    context?: { columnGrouping: GroupingField; beforeTicketId?: string },
  ) => void;
  onMoveToGroup?: (
    ticketId: string,
    targetGroupKey: string,
    context?: { rowGrouping: GroupingField; beforeTicketId?: string },
  ) => void;
  onCreateTicket?: (columnId: string) => void;
  onColumnAction?: (columnId: string, actionId: string) => Promise<void> | void;
  getBoardColumnConfig?: (groupKey: string) => BoardColumnConfig;
}

interface BuildListItemsInput<TTicket extends DataRendererRow> {
  settings: DataRendererSettings;
  visibleTickets: TTicket[];
  grouped: DataRendererColumnGroup[];
  tagDefinitions: DataRendererTagDefinition[];
  onTicketClick?: (ticket: TTicket) => void;
  onTagChange?: (ticketId: string, tagName: string, newValue: string) => void;
  onMoveTicket?: (
    ticketId: string,
    targetColumnId: string,
    context?: { columnGrouping: GroupingField; beforeTicketId?: string },
  ) => void;
  onMoveToGroup?: (
    ticketId: string,
    targetGroupKey: string,
    context?: { rowGrouping: GroupingField; beforeTicketId?: string },
  ) => void;
}

const buildListItems = <TTicket extends DataRendererRow>(
  input: BuildListItemsInput<TTicket>,
): DataRendererListItem[] => {
  const { settings, visibleTickets, grouped, tagDefinitions, onTicketClick, onTagChange, onMoveTicket, onMoveToGroup } =
    input;

  const toListItem = (ticket: TTicket, placement?: { columnKey?: string; rowKey?: string }): DataRendererListItem => ({
    id: ticket.id,
    ticketId: settings.displayProperties.includes("id") ? ticket.ticketId : "",
    title: ticket.title,
    badges: toBadges(ticket, settings.displayProperties),
    tagBadges: toTagBadges(ticket, settings.displayProperties, tagDefinitions),
    onClick: () => onTicketClick?.(ticket),
    onTagChange: onTagChange ? (tagName, newValue) => onTagChange(ticket.id, tagName, newValue) : undefined,
    draggable: Boolean(onMoveTicket),
    onDropTicket:
      settings.ordering.field === "manual" && onMoveTicket
        ? (draggedTicketId) => {
            const targetColumnKey = resolveListDropTargetColumnKey(settings.columnGrouping, placement);
            if (!targetColumnKey) {
              return;
            }

            onMoveTicket(draggedTicketId, targetColumnKey, {
              columnGrouping: settings.columnGrouping,
              beforeTicketId: ticket.id,
            });

            const rowKey = placement?.rowKey;
            if (settings.rowGrouping !== "none" && onMoveToGroup && rowKey) {
              onMoveToGroup(draggedTicketId, rowKey, {
                rowGrouping: settings.rowGrouping,
                beforeTicketId: ticket.id,
              });
            }
          }
        : undefined,
  });

  const toGroupListItem = (
    group: { key: string; label: string; tickets: DataRendererRow[] },
    parent?: { columnKey: string },
  ): DataRendererListItem => ({
    id: parent ? `group::${parent.columnKey}::${group.key}` : `group::${group.key}`,
    ticketId: "",
    title: toTitleCase(group.label),
    countBadge: group.tickets.length,
    onDropTicket:
      onMoveTicket && settings.columnGrouping !== "none"
        ? (draggedTicketId) => {
            const columnKey = parent?.columnKey ?? group.key;
            onMoveTicket(draggedTicketId, columnKey, {
              columnGrouping: settings.columnGrouping,
            });

            if (settings.rowGrouping !== "none" && onMoveToGroup && parent) {
              onMoveToGroup(draggedTicketId, group.key, {
                rowGrouping: settings.rowGrouping,
              });
            }
          }
        : undefined,
    children: orderRows(group.tickets, settings.ordering, tagDefinitions).map((ticket) =>
      toListItem(ticket as TTicket, {
        columnKey: parent?.columnKey ?? group.key,
        rowKey: parent ? group.key : undefined,
      }),
    ),
  });

  if (settings.columnGrouping === "none") {
    return orderRows(visibleTickets, settings.ordering, tagDefinitions).map((ticket) => toListItem(ticket as TTicket));
  }

  return grouped.map((group) => {
    if (group.rows.length > 0) {
      return {
        id: `group::${group.key}`,
        ticketId: "",
        title: toTitleCase(group.label),
        countBadge: group.tickets.length,
        onDropTicket: onMoveTicket
          ? (draggedTicketId: string) => {
              onMoveTicket(draggedTicketId, group.key, {
                columnGrouping: settings.columnGrouping,
              });
            }
          : undefined,
        children: group.rows.map((row) => toGroupListItem(row, { columnKey: group.key })),
      } satisfies DataRendererListItem;
    }

    return toGroupListItem(group);
  });
};

export const DataRenderer = <TTicket extends DataRendererRow>(props: DataRendererProps<TTicket>) => {
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
    defaultSettings,
    defaultFilters,
    onTicketClick,
    onTagChange,
    onMoveTicket,
    onMoveToGroup,
    onCreateTicket,
    onColumnAction,
    getBoardColumnConfig,
    hideToolbar = false,
    toolbarLeading,
  } = props;

  const initialState = { settings: defaultSettings, filters: defaultFilters };
  const settings = useDataRendererStore(storageKey, (state) => state.settings, initialState);
  const filters = useDataRendererStore(storageKey, (state) => state.filters, initialState);

  const visibleTickets = filterRows(tickets, filters) as TTicket[];

  const categoryOptions = filterCategories ?? buildDefaultFilterCategories(tickets, tagDefinitions);

  const knownColumnKeys = resolveKnownColumnKeys(
    settings.columnGrouping,
    knownColumnKeysProp,
    categoryOptions,
    filters,
  );

  const grouped = groupRows(visibleTickets, {
    columnGrouping: settings.columnGrouping,
    rowGrouping: settings.rowGrouping,
    knownColumnKeys,
  });

  const listItems = buildListItems({
    settings,
    visibleTickets,
    grouped,
    tagDefinitions,
    onTicketClick,
    onTagChange,
    onMoveTicket,
    onMoveToGroup,
  });

  const toBoardItems = (tickets: DataRendererRow[]) =>
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

  const boardColumns: DataRendererBoardColumn[] = grouped.map((column) => {
    const columnConfig = getBoardColumnConfig?.(column.key) ?? {};
    const orderedTickets = orderRows(column.tickets, settings.ordering, tagDefinitions);

    const groups: DataRendererBoardGroup[] | undefined =
      column.rows.length > 0
        ? column.rows.map((row) => ({
            key: row.key,
            label: toTitleCase(row.label),
            items: toBoardItems(orderRows(row.tickets, settings.ordering, tagDefinitions)),
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
    } satisfies DataRendererBoardColumn;
  });

  return (
    <Stack gap="sm" height="100%" minH="0">
      {hideToolbar ? null : (
        <DataRendererToolbar
          tickets={tickets}
          storageKey={storageKey}
          tagDefinitions={tagDefinitions}
          groupingOptions={groupingOptionsProp}
          orderingOptions={orderingOptionsProp}
          displayPropertyOptions={displayPropertyOptionsProp}
          filterCategories={categoryOptions}
          defaultSettings={defaultSettings}
          defaultFilters={defaultFilters}
          leading={toolbarLeading}
        />
      )}

      {settings.viewMode === "board" ? (
        <Box flex="1" minH="0">
          {boardColumns.length > 0 ? (
            <DataRendererBoard
              columns={boardColumns}
              selectedItemId={selectedTicketId}
              onMoveItem={(ticketId, targetColumnId, context) =>
                onMoveTicket?.(ticketId, targetColumnId, {
                  columnGrouping: settings.columnGrouping,
                  beforeTicketId: context?.beforeItemId,
                })
              }
              onMoveToGroup={(ticketId, targetGroupKey, context) =>
                onMoveToGroup?.(ticketId, targetGroupKey, {
                  rowGrouping: settings.rowGrouping,
                  beforeTicketId: context?.beforeItemId,
                })
              }
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
        <DataRendererList items={listItems} selectedItemId={selectedTicketId} />
      ) : (
        <EmptyState title={emptyTitle} description={emptyDescription} borderWidth="1px" borderRadius="md" />
      )}
    </Stack>
  );
};

export type { DataRendererProps };
