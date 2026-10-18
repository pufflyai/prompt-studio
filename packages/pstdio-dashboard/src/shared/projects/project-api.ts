import type { UpdateProjectInput } from "@pstdio/sdk/api";
import { getApiClient } from "@/lib/api";
export type UpdateProjectDefaultsInput = UpdateProjectInput;
export const getProjectDefaults = (projectId: string) => getApiClient().projects.get(projectId);
export const updateProjectDefaults = (projectId: string, input: UpdateProjectDefaultsInput) =>
  getApiClient().projects.update(projectId, input);
