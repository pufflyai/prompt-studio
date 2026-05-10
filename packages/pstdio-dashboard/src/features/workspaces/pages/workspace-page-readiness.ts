export const shouldShowWorkspaceTicketNotFound = (params: { hasTicket: boolean; areTicketsLoading: boolean }) => {
  const { hasTicket, areTicketsLoading } = params;

  return !hasTicket && !areTicketsLoading;
};
