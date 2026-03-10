import { type CreateTicketAttemptInput, createTicketAttempt } from "@/features/ticket-list/data/api";
import { useMutation } from "@/lib/use-mutation";

export const useCreateTicketAttempt = (projectId: string | undefined) =>
  useMutation(async (input: CreateTicketAttemptInput) => {
    if (!projectId) throw new Error("Project id is required to create ticket attempts.");
    return createTicketAttempt(input);
  });
