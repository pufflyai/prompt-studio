import { apiClient } from "@/features/api-client";

export const updateWhenAttemptStatus = async (
  ticketId: string,
  input: {
    all_attempts_status: string;
    set_status: string;
  },
) => apiClient().tickets.updateWhenAttemptStatus(ticketId, input);
