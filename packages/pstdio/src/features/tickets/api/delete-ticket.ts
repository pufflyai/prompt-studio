import { PstdioApiError } from "@pstdio/sdk/client";
import { apiClient } from "@/features/api-client";

export const deleteTicket = async (id: string) => {
  try {
    await apiClient().tickets.delete(id);
  } catch (error) {
    if (error instanceof PstdioApiError && error.status === 404) return null;
    throw error;
  }
};
