import { apiClient } from "@/features/api-client";

export const deleteProject = async (projectId: string) => {
  await apiClient().projects.delete(projectId);
};
