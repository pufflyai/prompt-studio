import { useQuery } from "@tanstack/react-query";
import { getTicketFiles } from "@/features/ticket-list/data/api";

export const useTicketFiles = (projectId: string | null | undefined, ticketId: string | null | undefined) =>
  useQuery({
    queryKey: ["planner-ticket-files", projectId, ticketId],
    queryFn: () => getTicketFiles(projectId!, ticketId!),
    enabled: Boolean(projectId && ticketId),
  });
