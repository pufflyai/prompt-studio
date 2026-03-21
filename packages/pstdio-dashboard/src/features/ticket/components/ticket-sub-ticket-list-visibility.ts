interface SubTicketEntry {
  id: string;
  shorthand: string;
  title: string;
}

export const hasVisibleSubTickets = (subTickets: SubTicketEntry[] | undefined) => (subTickets?.length ?? 0) > 0;
