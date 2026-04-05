import { apiClient } from "@/features/api-client";

export const createProject = async (name: string) => apiClient().projects.create({ name });
