import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type CreateTicketAttemptInput, createTicketAttempt } from "@/features/ticket-list/data/api";

export const useCreateTicketAttempt = (projectId: string | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<CreateTicketAttemptInput, "projectId">) => {
      if (!projectId) throw new Error("Project id is required to create ticket attempts.");
      return createTicketAttempt({ ...input, projectId });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["planner-tickets", projectId] });
    },
  });
};
