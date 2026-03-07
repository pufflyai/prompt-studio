import { useMutation, useQueryClient } from "@tanstack/react-query";
import { projectKeys } from "@/features/project/hooks/keys";
import { createProjectTicket } from "@/features/ticket-list/data/api";
import type { TicketStatus } from "@/features/ticket-list/types";

interface CreateProjectTicketInput {
  title: string;
  content?: string | null;
  complexity?: "low" | "medium" | "high" | null;
  status?: TicketStatus | null;
  parentId?: string | null;
}

export const useCreateProjectTicket = (projectId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateProjectTicketInput) => {
      if (!projectId) {
        throw new Error("Project id is required to create tickets.");
      }

      return createProjectTicket({ projectId, ...input });
    },
    onSuccess: () => {
      if (!projectId) return;
      queryClient.invalidateQueries({ queryKey: projectKeys.tickets(projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
    },
  });
};
