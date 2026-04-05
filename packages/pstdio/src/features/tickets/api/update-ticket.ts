import { apiClient } from "@/features/api-client";

type UpdateTicketInput = {
  display_title?: string;
  user_prompt?: string;
  file_id?: string;
  status_id?: string;
  draft?: boolean;
  archived?: boolean;
  tag_ids?: string[];
  blocked_reason?: string;
  parent_id?: string;
};

export const updateTicket = async (id: string, input: UpdateTicketInput) => apiClient().tickets.update(id, input);
