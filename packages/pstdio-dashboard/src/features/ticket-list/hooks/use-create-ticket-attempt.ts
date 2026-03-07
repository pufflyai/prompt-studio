import { useMutation, useQueryClient } from "@tanstack/react-query";
import { projectKeys } from "@/features/project/hooks/keys";
import { type CreateTicketAttemptInput, createTicketAttempt } from "@/features/ticket-list/data/api";

export const useCreateTicketAttempt = (projectId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateTicketAttemptInput) => {
      if (!projectId) {
        throw new Error("Project id is required to create ticket attempts.");
      }

      return createTicketAttempt(input);
    },
    onSuccess: () => {
      if (!projectId) return;
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.tickets(projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.sessions(projectId) });
    },
  });
};
