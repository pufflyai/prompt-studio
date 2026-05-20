import { Badge, Box, HStack, Stack, Text } from "@chakra-ui/react";
import type { WorkbenchWidgetRenderInput } from "pstdio-workbench/react";
import { EmptyState, SurfacePanel } from "@/services/components/surface";
import { ticketResource } from "@/services/workbench/resources/resource-kinds";
import type { DashboardStatus, DashboardTicket } from "../hooks/use-tickets";
import { useTicketStatuses, useTickets } from "../hooks/use-tickets";

interface TicketColumnModel {
  id: string;
  name: string;
  color: string;
  tickets: DashboardTicket[];
}

const buildColumns = (statuses: DashboardStatus[], tickets: DashboardTicket[]): TicketColumnModel[] => {
  const visible = tickets.filter((ticket) => !ticket.archived);
  const columns: TicketColumnModel[] = statuses.map((status) => ({
    id: status.id,
    name: status.name,
    color: status.color,
    tickets: visible.filter((ticket) => ticket.statusId === status.id),
  }));

  const knownStatusIds = new Set(statuses.map((status) => status.id));
  const unassigned = visible.filter((ticket) => !ticket.statusId || !knownStatusIds.has(ticket.statusId));
  if (unassigned.length > 0) {
    columns.push({ id: "__unassigned__", name: "No status", color: "gray", tickets: unassigned });
  }

  return columns;
};

const TicketCard = (props: { ticket: DashboardTicket; onOpen: () => void }) => {
  const { ticket, onOpen } = props;

  return (
    <Box
      as="button"
      textAlign="left"
      w="full"
      borderWidth="1px"
      borderColor="border.muted"
      borderRadius="md"
      bg="bg"
      p="sm"
      _hover={{ borderColor: "border.emphasized" }}
      onClick={onOpen}
    >
      <Stack gap="2xs">
        <HStack gap="xs">
          <Text textStyle="label/S/semibold" color="fg.muted">
            {ticket.shorthand}
          </Text>
          {ticket.draft ? (
            <Badge size="xs" colorPalette="gray">
              Draft
            </Badge>
          ) : null}
        </HStack>
        <Text textStyle="paragraph/S/regular" lineClamp={3}>
          {ticket.title}
        </Text>
      </Stack>
    </Box>
  );
};

const TicketColumn = (props: { column: TicketColumnModel; onOpenTicket: (ticket: DashboardTicket) => void }) => {
  const { column, onOpenTicket } = props;

  return (
    <Stack minW="260px" maxW="260px" gap="sm" h="full">
      <HStack gap="xs">
        <Badge colorPalette={column.color} size="sm">
          {column.name}
        </Badge>
        <Text textStyle="label/S/regular" color="fg.muted">
          {column.tickets.length}
        </Text>
      </HStack>
      <Stack gap="xs" overflowY="auto" flex="1" minH="0" pr="2xs">
        {column.tickets.map((ticket) => (
          <TicketCard key={ticket.id} ticket={ticket} onOpen={() => onOpenTicket(ticket)} />
        ))}
      </Stack>
    </Stack>
  );
};

export const TicketsBoard = (props: { input: WorkbenchWidgetRenderInput; projectId: string }) => {
  const { input, projectId } = props;
  const tickets = useTickets(projectId);
  const statuses = useTicketStatuses(projectId);
  const columns = buildColumns(statuses, tickets);

  const openTicket = (ticket: DashboardTicket) => {
    void input.workbench.resources.openResource(ticketResource(ticket.shorthand, ticket.title));
  };

  return (
    <SurfacePanel title="Tickets" subtitle={`${tickets.filter((ticket) => !ticket.archived).length} active`}>
      {columns.length === 0 ? (
        <EmptyState title="No tickets yet" description="Tickets synced from this project will appear here." />
      ) : (
        <HStack align="stretch" gap="md" h="full" overflowX="auto">
          {columns.map((column) => (
            <TicketColumn key={column.id} column={column} onOpenTicket={openTicket} />
          ))}
        </HStack>
      )}
    </SurfacePanel>
  );
};
