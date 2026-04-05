import { PstdioApiError } from "@pstdio/sdk/client";
import { apiClient } from "@/features/api-client";

export const getTemplate = async (projectId: string, name: string) => {
  try {
    return await apiClient().templates.get(projectId, name);
  } catch (error) {
    if (error instanceof PstdioApiError && error.status === 404) return null;
    throw error;
  }
};
