import { Stack } from "@chakra-ui/react";
import { TicketsWorkspace } from "@pstdio/ui";
import { useState } from "react";
import type { WorkbenchWidgetRenderInput } from "../../../react";
import {
  dashboardStatusColumns,
  dashboardTickets,
  dashboardTicketsWorkspaceStorageKey,
  dashboardTicketTags,
} from "../mock-data/data";

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

  const openTicket = (ticket: DashboardTicket) => {
    void input.workbench.resources.openResource(ticket.resource, { replaceActive: true }).then(input.refresh);
  };

  return (
    <Stack h="full" minH="0" gap="0" bg="bg">
      <TicketsWorkspace
        tickets={tickets.map(toWorkspaceTicket)}
        storageKey={dashboardTicketsWorkspaceStorageKey}
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
