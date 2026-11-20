import type { DeleteCloudProjectInput, RemoveLocalProjectInput } from "@pstdio/sdk/client";
import { apiClient } from "@/features/api-client";

export const listCloudProjects = () => apiClient().account.projectsCatalog();
export const inspectLocalRemoval = (id: string) => apiClient().account.projectLocalRemoval(id);
export const removeLocalProject = (id: string, input: RemoveLocalProjectInput) =>
  apiClient().account.removeLocalProject(id, input);
export const downloadCloudProject = (id: string) => apiClient().account.downloadCloudProject(id);
export const startCloudDeletion = (id: string, input: DeleteCloudProjectInput) =>
  apiClient().account.deleteCloudProject(id, input);
export const readCloudDeletion = (id: string) => apiClient().account.projectDeletionStatus(id);
