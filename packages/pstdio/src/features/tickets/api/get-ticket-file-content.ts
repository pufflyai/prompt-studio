import { apiClient } from "@/features/api-client";

export const getTicketFileContent = async (ticketId: string, fileId: string) =>
  Buffer.from(await apiClient().tickets.getFileContent(ticketId, fileId));
