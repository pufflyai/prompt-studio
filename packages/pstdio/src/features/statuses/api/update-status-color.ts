import { apiClient } from "@/features/api-client";

export const updateStatusColor = async (projectId: string, statusId: string, color: string) => {
  await apiClient().statuses.update(projectId, statusId, { color });
};
