import { Stack } from "@chakra-ui/react";
import { type FilterCategory, TicketsWorkspace, useTicketsWorkspaceStore } from "@pstdio/ui";
import { useEffect, useState } from "react";
import type { WorkbenchWidgetRenderInput } from "../../../react";
import {
  getTicketViewSnapshotFromResource,
  resolveTicketsWorkspaceStorageKey,
} from "../collections/saved-view-resources";
import { type TicketViewSnapshot, ticketViewToStore } from "../collections/ticket-view-mapping";
import { dashboardStatusColumns, dashboardTickets, dashboardTicketTags } from "../mock-data/data";

type DashboardTicket = (typeof dashboardTickets)[number];

const columnConfigById = new Map(
  dashboardStatusColumns.map((column) => [
    column.id,
    { color: column.color, canDragIn: true, canDragOut: column.id !== "done", canCreate: column.id !== "done" },
  ]),
);

const toWorkspaceTicket = (ticket: DashboardTicket) => ({
  ...ticket,
  title: `${ticket.id} ${ticket.title}`,
});

export const TicketsWidget = (props: { input: WorkbenchWidgetRenderInput }) => {
  const { input } = props;
  const [tickets, setTickets] = useState(dashboardTickets);
  const storageKey = resolveTicketsWorkspaceStorageKey(input.placement.resource);
  const savedViewSnapshotKey = JSON.stringify(getTicketViewSnapshotFromResource(input.placement.resource) ?? null);
  const setViewMode = useTicketsWorkspaceStore(storageKey, (state) => state.setViewMode);
  const setColumnGrouping = useTicketsWorkspaceStore(storageKey, (state) => state.setColumnGrouping);
  const setRowGrouping = useTicketsWorkspaceStore(storageKey, (state) => state.setRowGrouping);
  const setOrdering = useTicketsWorkspaceStore(storageKey, (state) => state.setOrdering);
  const setDisplayProperties = useTicketsWorkspaceStore(storageKey, (state) => state.setDisplayProperties);
  const clearAllFilters = useTicketsWorkspaceStore(storageKey, (state) => state.clearAllFilters);
  const setFilter = useTicketsWorkspaceStore(storageKey, (state) => state.setFilter);

  useEffect(() => {
    const savedViewSnapshot = JSON.parse(savedViewSnapshotKey) as TicketViewSnapshot | null;
    if (!savedViewSnapshot) return;
    const { filters, settings } = ticketViewToStore(savedViewSnapshot);
    setViewMode(settings.viewMode);
    setColumnGrouping(settings.columnGrouping);
    setRowGrouping(settings.rowGrouping);
    setOrdering(settings.ordering);
    setDisplayProperties(settings.displayProperties);
    clearAllFilters();
    for (const [category, values] of Object.entries(filters)) {
      if (!values) continue;
      setFilter(category as FilterCategory, values);
    }
  }, [
    savedViewSnapshotKey,
    setViewMode,
    setColumnGrouping,
    setRowGrouping,
    setOrdering,
    setDisplayProperties,
    clearAllFilters,
    setFilter,
  ]);

  const openTicket = (ticket: DashboardTicket) => {
    void input.workbench.resources.openResource(ticket.resource, { replaceActive: true }).then(input.refresh);
  };

  return (
    <Stack h="full" minH="0" gap="0" bg="bg">
      <TicketsWorkspace
        tickets={tickets.map(toWorkspaceTicket)}
        storageKey={storageKey}
        tagDefinitions={dashboardTicketTags}
        knownColumnKeys={dashboardStatusColumns.map((column) => column.id)}
        hideToolbar
        onTicketClick={openTicket}
        onMoveTicket={(ticketId, targetColumnId) => {
          setTickets((current) =>
            current.map((ticket) => (ticket.id === ticketId ? { ...ticket, status: targetColumnId } : ticket)),
          );
        }}
        onTagChange={(ticketId, tagName, newValue) => {
          setTickets((current) =>
            current.map((ticket) =>
              ticket.id === ticketId
                ? {
                    ...ticket,
                    tags: ticket.tags.map((tag) => (tag.name === tagName ? { ...tag, value: newValue } : tag)),
                  }
                : ticket,
            ),
          );
        }}
        onCreateTicket={(columnId) =>
          input.workbench.notifications.show({ level: "info", title: `Create ticket in ${columnId}` })
        }
        getBoardColumnConfig={(groupKey) =>
          columnConfigById.get(groupKey) ?? { color: "gray", canDragIn: true, canDragOut: true, canCreate: true }
        }
      />
    </Stack>
  );
};
