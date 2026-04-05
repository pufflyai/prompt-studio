import { apiClient } from "@/features/api-client";

export const listRepos = async (projectId: string) => apiClient().projects.listRepos(projectId);
