import { apiClient } from "@/features/api-client";

export const deleteTag = async (projectId: string, tagId: string) => {
  await apiClient().tags.delete(projectId, tagId);
};
