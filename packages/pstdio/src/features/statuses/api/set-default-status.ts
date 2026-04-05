import { apiClient } from "@/features/api-client";

export const setDefaultStatus = async (projectId: string, statusId: string) => {
  await apiClient().statuses.setDefault(projectId, statusId);
};
