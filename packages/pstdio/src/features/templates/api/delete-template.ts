import { PstdioApiError } from "@pstdio/sdk/client";
import { apiClient } from "@/features/api-client";

export const deleteTemplate = async (projectId: string, name: string) => {
  try {
    await apiClient().templates.delete(projectId, name);
  } catch (error) {
    if (error instanceof PstdioApiError && error.status === 404) {
      throw new Error(`Template not found: ${name}`);
    }
    throw error;
  }
};
