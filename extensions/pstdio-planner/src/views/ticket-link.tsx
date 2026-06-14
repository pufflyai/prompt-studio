import { useTicketHost } from "../hooks/host-context";
import { useCommandQuery } from "../hooks/use-command";
import { TicketBadge } from "./ticket-badge";

const GET_TICKET = "pstdio-planner.get-ticket";

interface ResolvedTicket {
  id: string;
  shorthand: string;
  title?: string;
  parentId?: string | null;
}

interface TicketLinkProps {
  ticketId: string;
}

const ticketLabel = (ticket: ResolvedTicket) =>
  ticket.title ? `${ticket.shorthand} ${ticket.title}` : ticket.shorthand;

// Resolves a parent/dependency id to its shorthand and opens it as its own
// resource tab. Falls back to the raw id as plain text when the ticket can't be
// resolved (e.g. it was deleted) so the row never throws.
export const TicketLink = (props: TicketLinkProps) => {
  const { ticketId } = props;
  const { host } = useTicketHost();

  const ticketQuery = useCommandQuery<ResolvedTicket | null>({
    queryKey: ["ticket", ticketId],
    commandId: GET_TICKET,
    params: { id: ticketId },
  });

  const target = ticketQuery.data;
  const parentQuery = useCommandQuery<ResolvedTicket | null>({
    queryKey: ["ticket", target?.parentId],
    commandId: GET_TICKET,
    params: { id: target?.parentId },
    enabled: Boolean(target?.parentId),
  });

  if (!target) {
    return <TicketBadge label={ticketId} color="fg.muted" />;
  }

  const parent = parentQuery.data;
  const metadata = target.parentId
    ? {
        parentTicketId: target.parentId,
        parentTicketLabel: parent ? ticketLabel(parent) : target.parentId,
        parentTicketShorthand: parent?.shorthand ?? target.parentId,
      }
    : undefined;
  const open = () => {
    const resource = {
      type: "ticket",
      id: target.id,
      label: ticketLabel(target),
      ...(metadata ? { metadata } : {}),
    };

    void host.call("resource.open", { resource }).catch(() => undefined);
  };

  return <TicketBadge label={target.shorthand} title={ticketLabel(target)} onSelect={open} />;
};
