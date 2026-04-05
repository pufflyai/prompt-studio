import { apiClient } from "@/features/api-client";

export const deleteStatus = async (projectId: string, statusId: string) => {
  await apiClient().statuses.delete(projectId, statusId);
};
