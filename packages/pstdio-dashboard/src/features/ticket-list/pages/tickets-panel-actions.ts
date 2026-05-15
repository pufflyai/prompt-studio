import type { useUpdateProjectTicket } from "@/features/ticket-list/hooks/use-project-tickets";
import type { Ticket, TicketStatus, TicketStatusOption } from "@/features/ticket-list/types";

export const archiveTicketsInColumn = async (input: {
  status: TicketStatus;
  statusOptions: TicketStatusOption[];
  tickets: Ticket[];
  updateTicket: ReturnType<typeof useUpdateProjectTicket>;
}) => {
  const { status, statusOptions, tickets, updateTicket } = input;
  const sourceStatus = statusOptions.find((col) => col.id === status || col.name === status);

  if (!sourceStatus) {
    console.error("[archive all] Ticket status not found.");
    return;
  }

  const ticketsInColumn = tickets
    .filter((ticket) => ticket.status === sourceStatus.name)
    .sort((a, b) => a.shorthand.localeCompare(b.shorthand) || a.id.localeCompare(b.id));

  const results = await Promise.allSettled(
    ticketsInColumn.map((ticket) => updateTicket.mutateAsync({ ticketId: ticket.id, archived: true })),
  );
  const firstFailure = results.find((result) => result.status === "rejected");

  if (firstFailure && firstFailure.status === "rejected") {
    console.error("[archive all]", firstFailure.reason);
  }
};
