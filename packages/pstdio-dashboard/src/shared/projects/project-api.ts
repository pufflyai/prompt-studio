import { getApiClient } from "@/lib/api";

export const getProjectDefaults = (projectId: string, signal?: AbortSignal) =>
  getApiClient().projects.get(projectId, { signal });
