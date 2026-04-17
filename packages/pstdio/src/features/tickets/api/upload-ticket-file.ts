import { apiClient } from "@/features/api-client";

export const uploadTicketFile = async (
  ticketId: string,
  input: {
    file_name: string;
    relative_path?: string;
    content_base64: string;
    mime_type?: string;
  },
) => apiClient().tickets.uploadFile(ticketId, input);
