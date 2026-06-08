import { Button, Text } from "@chakra-ui/react";
import { Tooltip } from "@pstdio/ui";
import { useTicketHost } from "../hooks/host-context";
import { useCommandQuery } from "../hooks/use-command";

const GET_TICKET = "pstdio-planner.get-ticket";

interface ResolvedTicket {
  id: string;
  shorthand: string;
  title?: string;
}

interface TicketLinkProps {
  ticketId: string;
}

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
  if (!target) {
    return (
      <Text as="span" color="fg.muted">
        {ticketId}
      </Text>
    );
  }

  const open = () =>
    void host
      .call("resource.open", { resource: { type: "ticket", id: target.id, label: target.shorthand } })
      .catch(() => undefined);

  return (
    <Tooltip content={target.title ?? target.shorthand}>
      <Button size="xs" variant="outline" onClick={open}>
        {target.shorthand}
      </Button>
    </Tooltip>
  );
};
