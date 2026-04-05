import { PstdioApiError } from "@pstdio/sdk/client";
import { apiClient } from "@/features/api-client";

export const getTicket = async (id: string) => {
  try {
    return await apiClient().tickets.get(id);
  } catch (error) {
    if (error instanceof PstdioApiError && error.status === 404) return null;
    throw error;
  }
};
