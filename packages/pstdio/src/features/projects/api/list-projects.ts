import { apiClient } from "@/features/api-client";

export const listProjects = async () => apiClient().projects.list();
