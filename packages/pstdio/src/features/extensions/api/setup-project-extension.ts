import { apiClient } from "@/features/api-client";

export const setupProjectExtension = async (projectId: string, installName: string) =>
  apiClient().extensions.setupProjectExtension(projectId, installName);
