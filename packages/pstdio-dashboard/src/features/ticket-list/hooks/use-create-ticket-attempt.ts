import { useMutation } from "@tanstack/react-query";
import { type CreateTicketAttemptInput, createTicketAttempt } from "@/features/ticket-list/data/api";

export const useCreateTicketAttempt = (projectId: string | undefined) =>
  useMutation({
    mutationFn: async (input: CreateTicketAttemptInput) => {
      if (!projectId) throw new Error("Project id is required to create ticket attempts.");
      return createTicketAttempt(input);
    },
  });
