import { useQuery } from "@tanstack/react-query";
import { getTicketFiles } from "@/features/ticket-list/data/api";

export const ticketFileKeys = {
  all: ["ticketFiles"] as const,
  byTicket: (ticketId: string) => ["ticketFiles", ticketId] as const,
};

export const useTicketFiles = (ticketId: string | null | undefined, options?: { enabled?: boolean }) => {
  const enabled = (options?.enabled ?? true) && Boolean(ticketId);

  return useQuery({
    queryKey: ticketFileKeys.byTicket(ticketId ?? ""),
    queryFn: () => getTicketFiles(ticketId ?? ""),
    enabled,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
};
