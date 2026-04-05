export type { TicketFile } from "@pstdio/sdk/resources";

import { apiClient } from "@/features/api-client";

export const listTicketFiles = async (ticketId: string) => apiClient().tickets.listFiles(ticketId);
