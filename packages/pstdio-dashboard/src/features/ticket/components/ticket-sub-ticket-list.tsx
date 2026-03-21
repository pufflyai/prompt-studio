import { Stack } from "@chakra-ui/react";
import { ItemSection } from "@pstdio/ui";
import { useTranslation } from "react-i18next";
import { TicketLink } from "./ticket-link";
import { hasVisibleSubTickets } from "./ticket-sub-ticket-list-visibility";

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
  const { t } = useTranslation("tickets");

  if (!hasVisibleSubTickets(subTickets)) {
    return null;
  }

  const knownTicketIdSet = new Set(knownTicketIds);
  const hasKnownTickets = knownTicketIdSet.size > 0;

  return (
    <ItemSection title={t("ticketDetail.subTickets")} defaultOpen>
      <Stack gap="xs">
        {subTickets.map((subTicket) => {
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
        })}
      </Stack>
    </ItemSection>
  );
};
