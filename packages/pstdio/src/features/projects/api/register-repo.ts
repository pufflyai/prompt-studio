import { apiClient } from "@/features/api-client";

export const registerRepo = async (projectId: string, input: { name: string; path: string }) =>
  apiClient().projects.registerRepo(projectId, input);
