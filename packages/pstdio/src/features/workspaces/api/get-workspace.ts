import { PstdioApiError } from "@pstdio/sdk/client";
import { apiClient } from "@/features/api-client";

export const getWorkspace = async (projectId: string, shorthand: string) => {
  try {
    return await apiClient().workspaces.getByShorthand(projectId, shorthand);
  } catch (error) {
    if (error instanceof PstdioApiError && error.status === 404) return null;
    throw error;
  }
};
