import { PstdioApiError } from "@pstdio/sdk/client";
import { apiClient } from "@/features/api-client";

export const getProject = async (projectId: string) => {
  try {
    return await apiClient().projects.get(projectId);
  } catch (error) {
    if (error instanceof PstdioApiError && error.status === 404) return null;
    throw error;
  }
};
