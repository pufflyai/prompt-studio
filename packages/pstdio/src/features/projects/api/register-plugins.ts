import { apiClient } from "@/features/api-client";

export const registerPlugins = async (projectId: string) => apiClient().projects.registerPlugins(projectId);
