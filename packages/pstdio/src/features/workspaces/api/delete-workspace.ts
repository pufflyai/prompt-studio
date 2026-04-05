import { apiClient } from "@/features/api-client";

export const deleteWorkspace = async (id: string) => {
  await apiClient().workspaces.delete(id);
};
