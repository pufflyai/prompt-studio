import { apiClient } from "@/features/api-client";

export const deleteWorkspace = async (id: string, options?: { forget?: boolean }) => {
  await apiClient().workspaces.delete(id, options);
};
