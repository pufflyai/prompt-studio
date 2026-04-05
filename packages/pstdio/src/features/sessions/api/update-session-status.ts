import { PstdioApiError } from "@pstdio/sdk/client";
import { apiClient } from "@/features/api-client";

export const updateSessionStatus = async (sessionId: string, status: string) => {
  try {
    return await apiClient().sessions.updateStatus(sessionId, status);
  } catch (error) {
    if (error instanceof PstdioApiError && error.status === 404) return null;
    throw error;
  }
};
