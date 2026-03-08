import { Button, Stack } from "@chakra-ui/react";
import { ItemSection } from "@pstdio/ui";
import { TicketLink } from "./ticket-link";

interface SubTicketEntry {
  id: string;
  shorthand: string;
  title: string;
}

interface TicketSubTicketListProps {
  subTickets?: SubTicketEntry[];
  knownTicketIds?: string[];
  onSelectTicket?: (ticketId: string) => void;
}

export const TicketSubTicketList = (props: TicketSubTicketListProps) => {
  const { subTickets = [], knownTicketIds = [], onSelectTicket } = props;

  const knownTicketIdSet = new Set(knownTicketIds);
  const hasKnownTickets = knownTicketIdSet.size > 0;

  return (
    <ItemSection title="Sub-tickets" defaultOpen>
      <Stack gap="xs">
        {subTickets.length === 0 ? (
          <Button size="sm" variant="subtle" disabled alignSelf="flex-start">
            None
          </Button>
        ) : (
          subTickets.map((subTicket) => {
            const canSelect = Boolean(onSelectTicket) && (!hasKnownTickets || knownTicketIdSet.has(subTicket.id));

            return (
              <TicketLink
                key={subTicket.id}
                label={subTicket.shorthand}
                title={subTicket.title}
                onSelect={() => onSelectTicket?.(subTicket.id)}
                isDisabled={!canSelect}
              />
            );
          })
        )}
      </Stack>
    </ItemSection>
  );
};
